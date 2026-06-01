/**
 * AI answer-solving for KEYLESS papers — the first feature of the paid AI layer.
 *
 * Some uploaded papers ship no answer key anywhere: no inline answers, no marked
 * option, no separate mark scheme. The correct answers genuinely don't exist in
 * the source, so there's nothing to extract — the model has to SOLVE each one.
 * That makes it inherently a paid, per-call feature, and it's gated accordingly.
 *
 * Layers of defence, in order:
 *   503  — no AI provider key set (feature not configured yet)
 *   401  — not signed in (we attribute + meter usage per account)
 *   403  — signed in but not Pro
 *   400  — malformed body or over the per-request question cap
 *   429  — over the hourly fair-use ceiling
 *
 * The answers it returns are INFERENCES, not an official key — the client marks
 * every one "AI-suggested" with a confidence indicator. We never receive or
 * solve questions that already have an answer (the client only sends keyless
 * ones), so the solver can't override a genuine key.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEntitlement } from "@/lib/auth/entitlement";
import { getLlmClient, isAiConfigured } from "@/lib/llm/client";
import { recentUsageCount } from "@/lib/llm/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard bound on a single call's cost — caps the worst case per request. */
const MAX_QUESTIONS = 40;
/** Generous hourly ceiling, set well above any real user's pace. */
const MAX_CALLS_PER_HOUR = 30;

interface InOption {
  label: string;
  text: string;
}
interface InQuestion {
  id: string;
  type: string;
  stem: string;
  options?: InOption[];
}
interface SolveResult {
  id: string;
  answer: string;
  confidence: number;
  reasoning: string;
}

const SYSTEM = [
  "You generate an answer key for exam questions that have NO official key.",
  "For each question, determine the single best answer.",
  "",
  "Rules:",
  "- Multiple-choice (the question has options): return the LABEL of the correct",
  '  option EXACTLY as given (e.g. "B"). Choose exactly one.',
  "- Short-answer (no options): return a concise correct answer.",
  "- confidence is 0..1 — be honest and go LOW when a question is ambiguous,",
  "  multi-step, or relies on knowledge you are unsure of. These are inferences,",
  "  not an official key.",
  "- reasoning is one or two short sentences.",
  "",
  "Respond with ONLY a JSON array — no prose, no markdown, no code fences — shaped:",
  '[{"id":"<id>","answer":"<label or text>","confidence":<0..1>,"reasoning":"<short>"}]',
].join("\n");

/** Pull a JSON array out of the model text even if it wrapped it in fences/prose. */
function parseResults(text: string): SolveResult[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("model did not return a JSON array");
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error("model output was not an array");
  return parsed
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      id: String(r.id ?? ""),
      answer: String(r.answer ?? "").trim(),
      confidence: clamp01(Number(r.confidence)),
      reasoning: String(r.reasoning ?? "").trim(),
    }));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export async function POST(req: Request) {
  // 503 — not configured.
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI answer-solving isn’t configured yet." },
      { status: 503 },
    );
  }

  // 401 — must be signed in (usage is metered per account).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to use AI solving." }, { status: 401 });
  }

  // 403 — Pro only.
  const ent = await getEntitlement(userId);
  if (!ent.pro) {
    return NextResponse.json(
      { error: "AI answer-solving is a Pro feature." },
      { status: 403 },
    );
  }

  // Parse + validate the body.
  let body: { questions?: InQuestion[] };
  try {
    body = (await req.json()) as { questions?: InQuestion[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const questions = (body.questions ?? []).filter(
    (q) => q && typeof q.id === "string" && typeof q.stem === "string",
  );
  if (!questions.length) {
    return NextResponse.json({ error: "No questions to solve." }, { status: 400 });
  }
  if (questions.length > MAX_QUESTIONS) {
    return NextResponse.json(
      { error: `Too many questions at once — solve up to ${MAX_QUESTIONS} at a time.` },
      { status: 400 },
    );
  }

  // 429 — hourly fair-use ceiling (durable; fails open if metering is down).
  const recent = await recentUsageCount(userId, "answer-solve", 60);
  if (recent >= MAX_CALLS_PER_HOUR) {
    return NextResponse.json(
      { error: "You’ve hit this hour’s AI limit — please try again shortly." },
      { status: 429 },
    );
  }

  const client = getLlmClient();
  if (!client) {
    return NextResponse.json(
      { error: "AI answer-solving isn’t configured yet." },
      { status: 503 },
    );
  }

  // Compact payload — only what the model needs to reason about.
  const payload = questions.map((q) => ({
    id: q.id,
    type: q.type,
    stem: q.stem,
    options: Array.isArray(q.options)
      ? q.options.map((o) => ({ label: o.label, text: o.text }))
      : [],
  }));

  const maxTokens = Math.min(8192, Math.max(1024, questions.length * 220 + 256));

  try {
    const out = await client.complete({
      feature: "answer-solve",
      userKey: userId,
      system: SYSTEM,
      temperature: 0,
      maxTokens,
      messages: [{ role: "user", content: `Questions:\n${JSON.stringify(payload)}` }],
    });

    const raw = parseResults(out.text);

    // Reconcile against the questions we sent: keep only ids we asked about, and
    // for MCQs make sure the answer is actually one of that question's labels
    // (case-insensitive) before trusting it.
    const byId = new Map(questions.map((q) => [q.id, q]));
    const results = raw
      .filter((r) => byId.has(r.id))
      .map((r) => {
        const q = byId.get(r.id)!;
        const opts = Array.isArray(q.options) ? q.options : [];
        if (opts.length > 0) {
          const match = opts.find((o) => o.label.toLowerCase() === r.answer.toLowerCase());
          if (!match) return null; // model named a non-existent option — drop it
          return { ...r, answer: match.label };
        }
        return r.answer ? r : null;
      })
      .filter((r): r is SolveResult => r !== null);

    return NextResponse.json(
      { results, model: out.model },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("ai/solve failed", err);
    return NextResponse.json(
      { error: "The AI couldn’t solve these right now. Please try again." },
      { status: 502 },
    );
  }
}
