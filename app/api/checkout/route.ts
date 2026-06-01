import { NextResponse, type NextRequest } from "next/server";

/**
 * Start a Stripe Checkout Session for the paid ("Pro") upgrade.
 *
 * WHY THIS IS SAFE (PCI SAQ A): card data never touches this server. We only
 * create a session with our secret key and hand the browser back the hosted
 * Stripe URL to redirect to — Stripe collects the card on their own page.
 *
 * Fulfillment is deliberately NOT done here. A success redirect can be forged,
 * so entitlement must be granted only by the signed `checkout.session.completed`
 * webhook (added during provisioning — see SETUP runbook). This route just opens
 * the session.
 *
 * GRACEFUL DEGRADATION: until STRIPE_SECRET_KEY + STRIPE_PRICE_ID exist (see
 * .env.example), this returns 503 and the rest of the app keeps working — there
 * are no hard dependencies on billing being configured.
 *
 * No SDK dependency: we call Stripe's REST API directly with fetch, so adding
 * this route can't break the build or the Vercel deploy.
 */
export const runtime = "nodejs";

interface CheckoutBody {
  /** The local account id, mirrored onto the session so the webhook can map a
   *  completed payment back to the user who started it. */
  accountId?: string;
  /** Optional: prefill the email on Stripe's checkout page. */
  email?: string;
  /** Which Price to charge. Defaults to monthly; "yearly" uses
   *  STRIPE_PRICE_ID_YEARLY when it's configured (else falls back to monthly). */
  plan?: "monthly" | "yearly";
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;

  let body: CheckoutBody = {};
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    /* empty / non-JSON body is fine — all fields are optional */
  }

  // Pick the Price for the requested plan. Yearly is optional; if it isn't set
  // we quietly fall back to monthly rather than failing.
  const monthly = process.env.STRIPE_PRICE_ID;
  const yearly = process.env.STRIPE_PRICE_ID_YEARLY;
  const price = body.plan === "yearly" && yearly ? yearly : monthly;

  // Unconfigured → degrade cleanly rather than 500.
  if (!secret || !price) {
    return NextResponse.json(
      { error: "Billing isn’t configured yet." },
      { status: 503 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const form = new URLSearchParams();
  form.set("mode", process.env.STRIPE_MODE || "subscription");
  form.set("line_items[0][price]", price);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${origin}/upgrade?status=success`);
  form.set("cancel_url", `${origin}/upgrade?status=cancelled`);
  if (body.accountId) {
    // Carried two ways so the webhook can read whichever it prefers.
    form.set("client_reference_id", body.accountId);
    form.set("metadata[accountId]", body.accountId);
  }
  if (body.email) form.set("customer_email", body.email);

  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (e) {
    console.error("Stripe checkout: network error", e);
    return NextResponse.json(
      { error: "Couldn’t reach the payment provider. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    console.error("Stripe checkout: API error", res.status, await res.text());
    return NextResponse.json(
      { error: "Couldn’t start checkout. Please try again." },
      { status: 502 },
    );
  }

  const session = (await res.json()) as { url?: string };
  if (!session.url) {
    return NextResponse.json(
      { error: "Checkout session was created without a URL." },
      { status: 502 },
    );
  }

  // The browser redirects here; Stripe hosts the card form.
  return NextResponse.json({ url: session.url });
}
