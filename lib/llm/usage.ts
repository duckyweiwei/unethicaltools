/**
 * Cost instrumentation for the AI layer. Per the monetization plan, EVERY LLM
 * call is logged with its token counts and computed dollar cost, tagged by
 * feature, model, and user — so margins are measured, not guessed, and the
 * heavy-user (p95) tail is visible.
 *
 * Best-effort and never throws into the request path: if the DB is unconfigured
 * (or a write fails) we fall back to a structured server log line. Only usage
 * METADATA is recorded here — never quiz content. The "we host nothing of your
 * content" promise holds.
 */
import { getSql, hasDb } from "@/lib/db/sql";

export interface UsageEvent {
  /** Stable identity (the Google subject id) the call is billed against. */
  userKey: string;
  /** Which capability spent this — "answer-solve", "explain", … */
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** How many calls a user has made for a feature within the last `withinMinutes`.
 *  Powers the fair-use ceiling. FAILS OPEN (returns 0) when there's no DB or the
 *  query errors — a metering hiccup must never block a paying user. */
export async function recentUsageCount(
  userKey: string,
  feature: string,
  withinMinutes: number,
): Promise<number> {
  if (!hasDb() || !userKey) return 0;
  try {
    const sql = getSql();
    const rows = (await sql`
      select count(*)::int as n
      from usage_events
      where user_key = ${userKey}
        and feature = ${feature}
        and created_at > now() - make_interval(mins => ${withinMinutes})
    `) as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch (err) {
    console.error("recentUsageCount failed", err);
    return 0;
  }
}

/** Persist one billable call. Never rejects — a logging failure can't break the
 *  user-facing request, it just downgrades to a console line. */
export async function recordUsage(e: UsageEvent): Promise<void> {
  try {
    if (hasDb()) {
      const sql = getSql();
      await sql`
        insert into usage_events
          (id, user_key, feature, model, input_tokens, output_tokens, cost_usd)
        values
          (${crypto.randomUUID()}, ${e.userKey}, ${e.feature}, ${e.model},
           ${e.inputTokens}, ${e.outputTokens}, ${e.costUsd})
      `;
    } else {
      console.log("[ai-usage]", JSON.stringify(e));
    }
  } catch (err) {
    console.error("recordUsage failed", err);
  }
}
