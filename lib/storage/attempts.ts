/**
 * Per-attempt study history — the data behind the progress dashboard (/stats).
 *
 * Every finished test run is recorded here so we can show what's working and
 * what isn't: most-missed questions, accuracy by source PDF, first-try vs.
 * after-retry accuracy, an accuracy trend over time, and a light
 * spaced-repetition list of weak items due for another look.
 *
 * Backed by localStorage (no account/backend yet), per-browser, and SSR-safe:
 * on the server (no `window`) reads return empty and writes no-op, so importing
 * this from a client component never crashes during prerender. We snapshot the
 * question stem onto each item so the history stays readable even after the
 * source quiz is edited or deleted.
 */
import type { QuestionType } from "@/lib/domain/types";
import { asArray, asBool, asEnum, asFiniteNumber, asString, isRecord } from "@/lib/storage/coerce";

const KEY = "pdfquiz:attempts";

/** The closed sets used when normalizing untrusted stored records. */
const MODES = ["page", "step", "flash"] as const;
const QUESTION_TYPES: readonly QuestionType[] = ["mcq", "true_false", "cloze", "matching", "open"];
/** Keep history bounded so localStorage never fills from study alone. Oldest
 *  attempts fall off the end; the dashboard's trends still have plenty. */
const MAX_ATTEMPTS = 500;
/** Broadcast on every save so an open dashboard in the same tab can refresh
 *  (the native `storage` event only fires in OTHER tabs). */
export const ATTEMPTS_EVENT = "pdfquiz:attempts-changed";

/** One graded question within a recorded attempt. */
export interface AttemptItem {
  /** The question id as it ran (may be namespaced `quizId::origId` in a combined
   *  run). Stable across runs of the same quiz, so it aggregates over attempts. */
  questionId: string;
  /** Snapshot of the stem at attempt time — kept so history survives edits. */
  stem: string;
  type: QuestionType;
  /** Source PDF this question came from, when the quiz spans multiple files. */
  sourceLabel?: string;
  /** Graded correct. */
  correct: boolean;
  /** Left unanswered (no choice / no self-grade). */
  skipped: boolean;
}

/** A single finished test run. */
export interface AttemptRecord {
  id: string;
  quizId: string;
  quizTitle: string;
  /** "page" = all-on-one-page, "step" = one-at-a-time, "flash" = flashcards
   *  (self-graded known/again per card). */
  mode: "page" | "step" | "flash";
  /** Whether this run was a "retry wrong" pass rather than a fresh attempt. */
  isRetry: boolean;
  /** ISO timestamps bracketing the run. */
  startedAt: string;
  finishedAt: string;
  /** Wall-clock duration of the run, milliseconds. */
  durationMs: number;
  score: number;
  total: number;
  items: AttemptItem[];
}

/** Repair one graded item's SHAPE; drop it only if it has no id to aggregate by.
 *  Text fields are preserved verbatim — we coerce types, never rewrite content. */
function normalizeItem(raw: unknown): AttemptItem | null {
  if (!isRecord(raw)) return null;
  const questionId = asString(raw.questionId);
  if (!questionId) return null;
  return {
    questionId,
    stem: asString(raw.stem),
    type: asEnum<QuestionType>(raw.type, QUESTION_TYPES, "mcq"),
    sourceLabel: typeof raw.sourceLabel === "string" ? raw.sourceLabel : undefined,
    correct: asBool(raw.correct),
    skipped: asBool(raw.skipped),
  };
}

/** Repair one attempt's SHAPE so the analytics functions (which iterate
 *  `a.items` and sum `score`/`total`/`durationMs`) can never throw. Records with
 *  no id are unusable and dropped; everything else is coerced into a safe shape,
 *  with `items` guaranteed to be an array of well-formed items. */
function normalizeAttempt(raw: unknown): AttemptRecord | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    quizId: asString(raw.quizId),
    quizTitle: asString(raw.quizTitle, "Untitled quiz"),
    mode: asEnum(raw.mode, MODES, "page"),
    isRetry: asBool(raw.isRetry),
    startedAt: asString(raw.startedAt),
    finishedAt: asString(raw.finishedAt),
    durationMs: Math.max(0, asFiniteNumber(raw.durationMs)),
    score: asFiniteNumber(raw.score),
    total: asFiniteNumber(raw.total),
    items: asArray(raw.items)
      .map(normalizeItem)
      .filter((x): x is AttemptItem => x !== null),
  };
}

function read(): AttemptRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate-and-normalize every record so a single legacy/corrupt entry can't
    // make the dashboard throw mid-render (which, with no error boundary, looked
    // to the user like the "Progress" nav link doing nothing).
    return parsed
      .map(normalizeAttempt)
      .filter((x): x is AttemptRecord => x !== null);
  } catch {
    return [];
  }
}

function write(list: AttemptRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(ATTEMPTS_EVENT));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

function makeId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `att_${rand}`;
}

/** Record a finished run. Returns the stored record (with its generated id). */
export function saveAttempt(rec: Omit<AttemptRecord, "id">): AttemptRecord {
  const record: AttemptRecord = { ...rec, id: makeId() };
  const list = read();
  list.push(record);
  // Trim oldest-first if we've grown past the cap.
  write(list.length > MAX_ATTEMPTS ? list.slice(list.length - MAX_ATTEMPTS) : list);
  return record;
}

/** Every recorded attempt, newest first. */
export function listAttempts(): AttemptRecord[] {
  return read().sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
}

/** Attempts for one quiz, newest first. */
export function attemptsForQuiz(quizId: string): AttemptRecord[] {
  return listAttempts().filter((a) => a.quizId === quizId);
}

/** Wipe all study history. */
export function clearAttempts(): void {
  write([]);
}

// ---- Derived analytics (pure over a list of attempts) -----------------------
// These take the attempts as input so the dashboard reads once and computes
// everything from a single snapshot.

export interface Summary {
  attempts: number;
  /** Total graded questions across all attempts (counts repeats). */
  questionsAnswered: number;
  correct: number;
  /** 0..1 overall accuracy, or null when nothing's been answered. */
  accuracy: number | null;
  /** Total time spent studying, milliseconds. */
  totalTimeMs: number;
  /** Mean time per graded question, ms, or null when no timing/answers. */
  avgPerQuestionMs: number | null;
}

export function summarize(attempts: AttemptRecord[]): Summary {
  let questionsAnswered = 0;
  let correct = 0;
  let totalTimeMs = 0;
  for (const a of attempts) {
    questionsAnswered += a.total;
    correct += a.score;
    totalTimeMs += Math.max(0, a.durationMs);
  }
  return {
    attempts: attempts.length,
    questionsAnswered,
    correct,
    accuracy: questionsAnswered > 0 ? correct / questionsAnswered : null,
    totalTimeMs,
    avgPerQuestionMs: questionsAnswered > 0 ? totalTimeMs / questionsAnswered : null,
  };
}

export interface SourceAccuracy {
  source: string;
  correct: number;
  total: number;
  accuracy: number;
}

/** Accuracy grouped by source PDF (the closest thing we have to "topic" without
 *  free-form tagging). Questions with no source label fold into "Ungrouped". */
export function accuracyBySource(attempts: AttemptRecord[]): SourceAccuracy[] {
  const by = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    for (const it of a.items) {
      const key = it.sourceLabel?.trim() || "Ungrouped";
      const agg = by.get(key) ?? { correct: 0, total: 0 };
      agg.total += 1;
      if (it.correct) agg.correct += 1;
      by.set(key, agg);
    }
  }
  return [...by.entries()]
    .map(([source, { correct, total }]) => ({
      source,
      correct,
      total,
      accuracy: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // weakest first — most actionable
}

export interface SplitAccuracy {
  firstTry: { correct: number; total: number; accuracy: number | null };
  retry: { correct: number; total: number; accuracy: number | null };
}

/** First-try (fresh attempts) vs. after-retry ("retry wrong" runs) accuracy —
 *  shows whether revisiting misses is paying off. */
export function firstTryVsRetry(attempts: AttemptRecord[]): SplitAccuracy {
  const acc = {
    firstTry: { correct: 0, total: 0 },
    retry: { correct: 0, total: 0 },
  };
  for (const a of attempts) {
    const bucket = a.isRetry ? acc.retry : acc.firstTry;
    bucket.total += a.total;
    bucket.correct += a.score;
  }
  const ratio = (b: { correct: number; total: number }) =>
    b.total > 0 ? b.correct / b.total : null;
  return {
    firstTry: { ...acc.firstTry, accuracy: ratio(acc.firstTry) },
    retry: { ...acc.retry, accuracy: ratio(acc.retry) },
  };
}

export interface TrendPoint {
  id: string;
  finishedAt: string;
  quizTitle: string;
  accuracy: number;
  total: number;
}

/** Accuracy per attempt in chronological order — the trend line. */
export function accuracyTrend(attempts: AttemptRecord[]): TrendPoint[] {
  return [...attempts]
    .filter((a) => a.total > 0)
    .sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1))
    .map((a) => ({
      id: a.id,
      finishedAt: a.finishedAt,
      quizTitle: a.quizTitle,
      accuracy: a.score / a.total,
      total: a.total,
    }));
}

export interface QuestionStat {
  questionId: string;
  stem: string;
  sourceLabel?: string;
  seen: number;
  wrong: number;
  /** Fraction of times this question was missed, 0..1. */
  missRate: number;
  /** Most recent result for this question. */
  lastWrong: boolean;
  lastSeenAt: string;
}

/** Roll up every question across attempts. Newer attempts win for the stem
 *  snapshot and the "most recent result". */
function aggregateQuestions(attempts: AttemptRecord[]): QuestionStat[] {
  const by = new Map<string, QuestionStat>();
  // Oldest → newest so the last write reflects the most recent attempt.
  const chrono = [...attempts].sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1));
  for (const a of chrono) {
    for (const it of a.items) {
      const prev = by.get(it.questionId);
      const seen = (prev?.seen ?? 0) + 1;
      const wrong = (prev?.wrong ?? 0) + (it.correct ? 0 : 1);
      by.set(it.questionId, {
        questionId: it.questionId,
        stem: it.stem,
        sourceLabel: it.sourceLabel,
        seen,
        wrong,
        missRate: wrong / seen,
        lastWrong: !it.correct,
        lastSeenAt: a.finishedAt,
      });
    }
  }
  return [...by.values()];
}

/** The questions you miss most — wrong count first, then miss-rate. */
export function mostMissed(attempts: AttemptRecord[], limit = 8): QuestionStat[] {
  return aggregateQuestions(attempts)
    .filter((q) => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.missRate - a.missRate)
    .slice(0, limit);
}

/**
 * Weak items due for another look — a light spaced-repetition signal. An item is
 * "due" when your MOST RECENT answer was wrong, or you miss it at least half the
 * time after seeing it more than once. Ordered by how shaky it is (miss-rate),
 * then most-recently-missed.
 */
export function weakItemsDue(attempts: AttemptRecord[], limit = 10): QuestionStat[] {
  return aggregateQuestions(attempts)
    .filter((q) => q.lastWrong || (q.seen >= 2 && q.missRate >= 0.5))
    .sort(
      (a, b) =>
        b.missRate - a.missRate ||
        (a.lastSeenAt < b.lastSeenAt ? 1 : -1),
    )
    .slice(0, limit);
}

// ---- Study guide (a prescriptive plan over the analytics above) -------------

/** A source counts as "on track" at or above this accuracy; below it lands in
 *  the focus list. Also the goal we tell the learner to aim for. */
export const MASTERY_TARGET = 0.8;

/** One prescriptive recommendation. `tone` drives the colour of its chip. */
export interface StudyAction {
  /** Stable key for rendering. */
  id: string;
  /** Imperative recommendation, e.g. "Restudy Chemistry P1". */
  text: string;
  /** The "why" / supporting numbers, shown under the recommendation. */
  detail?: string;
  /** Urgency: high (rose), medium (amber), good (emerald), info (neutral). */
  tone: "high" | "medium" | "good" | "info";
}

/** A complete, deterministic study plan derived from attempt history. */
export interface StudyGuide {
  /** Too little history to advise confidently — drives softer copy + a nudge. */
  sparse: boolean;
  overall: Summary;
  /** Sources below the mastery target, weakest first — where to focus. */
  focus: SourceAccuracy[];
  /** Sources at/above the target — what's already solid. */
  strong: SourceAccuracy[];
  /** Specific shaky questions to review next. */
  review: QuestionStat[];
  /** Questions missed most often. */
  missed: QuestionStat[];
  /** Ordered next actions, highest priority first. */
  actions: StudyAction[];
}

/**
 * Turn raw attempt history into a prescriptive guide: which sources to focus on,
 * which exact questions to review, and an ordered list of next actions. Pure and
 * deterministic (no model) — the same history always yields the same guide.
 */
export function studyGuide(attempts: AttemptRecord[]): StudyGuide {
  const overall = summarize(attempts);
  const bySource = accuracyBySource(attempts); // already weakest-first
  // A lone "Ungrouped" bucket just restates overall accuracy — not a real split.
  const meaningful =
    bySource.length === 1 && bySource[0].source === "Ungrouped" ? [] : bySource;
  const focus = meaningful.filter((s) => s.accuracy < MASTERY_TARGET);
  const strong = meaningful.filter((s) => s.accuracy >= MASTERY_TARGET);
  const review = weakItemsDue(attempts, 12);
  const missed = mostMissed(attempts, 8);
  const split = firstTryVsRetry(attempts);
  const sparse = attempts.length < 3 || overall.questionsAnswered < 10;

  const pctOf = (x: number) => Math.round(x * 100);
  const actions: StudyAction[] = [];

  // 1. The most direct lever: re-drill the specific shaky questions.
  if (review.length > 0) {
    actions.push({
      id: "retry-weak",
      tone: "high",
      text: `Review the ${review.length} weak ${review.length === 1 ? "question" : "questions"} below`,
      detail: "Your recent answers keep missing these — drill them until they stick.",
    });
  }
  // 2. The weakest source to restudy from scratch.
  if (focus.length > 0) {
    const w = focus[0];
    actions.push({
      id: "restudy-source",
      tone: w.accuracy < 0.5 ? "high" : "medium",
      text: `Restudy ${w.source}`,
      detail: `You're at ${pctOf(w.accuracy)}% here (${w.correct}/${w.total}) — aim for ${pctOf(MASTERY_TARGET)}%.`,
    });
  }
  // 3. Nudge the retry-wrong loop when it's unused but there are misses to convert.
  if (split.retry.total === 0 && missed.length > 0) {
    actions.push({
      id: "use-retry",
      tone: "info",
      text: "Use “Retry wrong” after each quiz",
      detail: "Re-drilling misses right away is the fastest way to convert them.",
    });
  }
  // 4. Recommend more data when the sample is thin.
  if (sparse) {
    actions.push({
      id: "more-data",
      tone: "info",
      text: "Take a few more quizzes",
      detail: "More attempts sharpen every recommendation on this page.",
    });
  }
  // 5. Nothing flagged — maintenance mode.
  if (actions.length === 0) {
    actions.push({
      id: "maintain",
      tone: "good",
      text: "You're in good shape — keep cycling your decks",
      detail:
        overall.accuracy != null
          ? `Overall accuracy ${pctOf(overall.accuracy)}%. Revisit occasionally to hold it there.`
          : undefined,
    });
  }

  return { sparse, overall, focus, strong, review, missed, actions };
}
