/**
 * Whether the AI layer is switched on (i.e. an ANTHROPIC_API_KEY is set). The
 * client uses this — together with the viewer's Pro status from /api/entitlement
 * — to decide whether to show AI actions at all. Mirrors /api/plans' `configured`
 * gate so the UI degrades quietly when AI isn't set up yet. Exposes no secret.
 */
import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/llm/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { configured: isAiConfigured() },
    { headers: { "cache-control": "no-store" } },
  );
}
