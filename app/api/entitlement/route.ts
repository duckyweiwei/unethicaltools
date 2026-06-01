/**
 * What the browser asks to learn "am I signed in, and am I Pro?". The real
 * enforcement of Pro features happens server-side; this endpoint just lets the
 * UI reflect the right state (show "Pro", hide the upgrade button, etc.).
 *
 * Never cached: entitlement flips the instant the Stripe webhook lands, and the
 * UI re-fetches this after returning from checkout.
 */
import { NextResponse } from "next/server";
import { getViewerEntitlement } from "@/lib/auth/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewerEntitlement();
  return NextResponse.json(viewer, {
    headers: { "cache-control": "no-store" },
  });
}
