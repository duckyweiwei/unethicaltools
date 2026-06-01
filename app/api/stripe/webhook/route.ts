/**
 * The ONLY place entitlement is granted. A success redirect can be forged, so we
 * never trust it — instead Stripe calls this endpoint with a signed event, we
 * verify the signature with STRIPE_WEBHOOK_SECRET, and only then flip the user to
 * Pro. This is the whole reason the architecture is safe: the browser can't lie
 * its way to Pro because it can't forge Stripe's signature.
 *
 * Node runtime + raw body are mandatory: signature verification hashes the exact
 * bytes Stripe sent, so we must read `req.text()` before anything parses it.
 *
 * Setup: create the endpoint in Stripe (Developers → Webhooks → Add endpoint,
 * URL = <origin>/api/stripe/webhook, event = checkout.session.completed) and put
 * its signing secret (whsec_…) in STRIPE_WEBHOOK_SECRET. Locally, `stripe listen
 * --forward-to localhost:PORT/api/stripe/webhook` prints one and forwards events.
 */
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { setProByStripeCustomer, upsertEntitlement } from "@/lib/auth/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pull a plain id out of Stripe's `string | { id } | null` expandable fields. */
function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Unconfigured → 503, not 500. The webhook simply isn't live yet.
  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook isn’t configured." },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err) {
    // Bad signature / replayed payload / wrong secret — reject, don't act.
    console.error("Stripe webhook: signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // We stamped the account id on the session when we created it.
        const userKey =
          session.client_reference_id ?? session.metadata?.accountId ?? null;

        if (!userKey) {
          // A purchase we can't attribute to an account — log loudly and move on
          // (acknowledge so Stripe doesn't retry forever).
          console.error(
            "Stripe webhook: checkout completed without an account id",
            session.id,
          );
          break;
        }

        await upsertEntitlement({
          userKey,
          pro: true,
          email: session.customer_details?.email ?? session.customer_email ?? null,
          stripeCustomerId: idOf(session.customer),
          stripeSubscriptionId: idOf(session.subscription),
          status: "active",
        });
        break;
      }

      // Keep entitlement in step with the subscription's life: a cancellation or a
      // lapse should drop Pro; a renewal/reactivation should restore it.
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await setProByStripeCustomer(idOf(sub.customer) ?? "", false, sub.status);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const active = sub.status === "active" || sub.status === "trialing";
        await setProByStripeCustomer(idOf(sub.customer) ?? "", active, sub.status);
        break;
      }

      default:
        // Unhandled event types are fine — acknowledge so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // A DB hiccup: return 500 so Stripe retries with backoff (events are
    // idempotent here — re-applying the same grant is harmless).
    console.error("Stripe webhook: handler error", err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
