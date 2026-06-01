/**
 * The real prices for the upgrade screen, read live from Stripe so the amounts on
 * our page can never drift from what Stripe actually charges. We only expose
 * non-sensitive display fields (amount, currency, interval) — the secret key
 * stays on the server.
 *
 * Degrades to `{ configured: false }` when Stripe isn't set up, so the upgrade
 * screen can show a friendly "not available yet" instead of erroring.
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlanInfo {
  id: string;
  amount: number | null;
  currency: string;
  interval: string | null;
}

export async function GET() {
  const secret = process.env.STRIPE_SECRET_KEY;
  const monthlyId = process.env.STRIPE_PRICE_ID;
  const yearlyId = process.env.STRIPE_PRICE_ID_YEARLY;

  if (!secret || !monthlyId) {
    return NextResponse.json({ configured: false });
  }

  const stripe = new Stripe(secret);

  async function load(id?: string): Promise<PlanInfo | null> {
    if (!id) return null;
    try {
      const p = await stripe.prices.retrieve(id);
      return {
        id: p.id,
        amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval ?? null,
      };
    } catch (err) {
      console.error("plans: failed to load price", id, err);
      return null;
    }
  }

  const [monthly, yearly] = await Promise.all([load(monthlyId), load(yearlyId)]);

  return NextResponse.json(
    { configured: true, monthly, yearly },
    { headers: { "cache-control": "no-store" } },
  );
}
