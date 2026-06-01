/**
 * Entitlement = "has this identity paid?". SERVER-ONLY: it talks to the database
 * and reads the auth session, so it must never be imported into a client
 * component (the browser asks `/api/entitlement` instead).
 *
 * Reads degrade gracefully — no database, no session, or a query error all resolve
 * to "not Pro" rather than throwing, so a billing/DB outage can never lock a user
 * out of the free product. Writes (the webhook path) do throw, because a dropped
 * write would silently fail to deliver something the user paid for.
 */
import { auth } from "@/auth";
import { getSql, hasDb } from "@/lib/db/sql";

export interface Entitlement {
  pro: boolean;
  status?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

interface EntitlementRow {
  pro: boolean;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/** Look up entitlement for a stable identity key (the Google subject id). Returns
 *  `{ pro: false }` when there's no DB, no row, or on any error. */
export async function getEntitlement(userKey: string): Promise<Entitlement> {
  if (!userKey || !hasDb()) return { pro: false };
  try {
    const sql = getSql();
    const rows = (await sql`
      select pro, status, stripe_customer_id, stripe_subscription_id
      from entitlements
      where user_key = ${userKey}
      limit 1
    `) as EntitlementRow[];
    const r = rows[0];
    if (!r) return { pro: false };
    return {
      pro: Boolean(r.pro),
      status: r.status,
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
    };
  } catch (err) {
    console.error("getEntitlement failed", err);
    return { pro: false };
  }
}

/** Viewer-facing snapshot for the current request's session. Safe to call from a
 *  server component or route handler. */
export async function getViewerEntitlement(): Promise<{
  signedIn: boolean;
  pro: boolean;
  email?: string | null;
  name?: string | null;
}> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return { signedIn: false, pro: false };
  const ent = await getEntitlement(user.id);
  return { signedIn: true, pro: ent.pro, email: user.email, name: user.name };
}

/** Upsert entitlement for an identity key — the webhook's grant path. Throws if
 *  the DB isn't configured: a paid event we can't record must be loud, not silent. */
export async function upsertEntitlement(params: {
  userKey: string;
  pro: boolean;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status?: string | null;
}): Promise<void> {
  if (!hasDb()) throw new Error("DATABASE_URL not set — can't record entitlement.");
  const sql = getSql();
  await sql`
    insert into entitlements
      (user_key, email, pro, stripe_customer_id, stripe_subscription_id, status, updated_at)
    values
      (${params.userKey}, ${params.email ?? null}, ${params.pro},
       ${params.stripeCustomerId ?? null}, ${params.stripeSubscriptionId ?? null},
       ${params.status ?? null}, now())
    on conflict (user_key) do update set
      email                  = coalesce(excluded.email, entitlements.email),
      pro                    = excluded.pro,
      stripe_customer_id     = coalesce(excluded.stripe_customer_id, entitlements.stripe_customer_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, entitlements.stripe_subscription_id),
      status                 = excluded.status,
      updated_at             = now()
  `;
}

/** Flip Pro on/off for whoever owns a Stripe customer — used by subscription
 *  lifecycle events (e.g. cancellation) that only carry the customer id. */
export async function setProByStripeCustomer(
  stripeCustomerId: string,
  pro: boolean,
  status?: string | null,
): Promise<void> {
  if (!hasDb() || !stripeCustomerId) return;
  const sql = getSql();
  await sql`
    update entitlements
    set pro = ${pro}, status = ${status ?? null}, updated_at = now()
    where stripe_customer_id = ${stripeCustomerId}
  `;
}
