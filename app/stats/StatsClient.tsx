"use client";

/**
 * Progress dashboard (/stats) — everything derived client-side from the
 * localStorage attempt history (lib/storage/attempts.ts). We read once on mount
 * and recompute the analytics from that single snapshot, refreshing whenever a
 * run is recorded (same-tab ATTEMPTS_EVENT), another tab writes (storage event),
 * or the window regains focus. No backend, no account required.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  listAttempts,
  clearAttempts,
  summarize,
  accuracyBySource,
  firstTryVsRetry,
  accuracyTrend,
  mostMissed,
  weakItemsDue,
  ATTEMPTS_EVENT,
  type AttemptRecord,
  type QuestionStat,
  type TrendPoint,
} from "@/lib/storage/attempts";
import { BarChart, Trash, Alert, Restart, Play, Target } from "@/components/quiz-editor/icons";

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** 0..1 → "73%", null → "—". */
function pct(x: number | null | undefined): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

/** Human-readable duration: "1h 23m" / "12m 30s" / "45s". */
function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "0s";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Accuracy → bar fill color (green good, amber middling, rose weak). */
function barTone(x: number | null): string {
  if (x == null) return "bg-neutral-200";
  if (x >= 0.8) return "bg-emerald-500";
  if (x >= 0.5) return "bg-amber-400";
  return "bg-rose-400";
}

/** Accuracy → text color, matching `barTone`. */
function textTone(x: number | null): string {
  if (x == null) return "text-neutral-400";
  if (x >= 0.8) return "text-emerald-600";
  if (x >= 0.5) return "text-amber-600";
  return "text-rose-600";
}

export function StatsClient() {
  const [attempts, setAttempts] = useState<AttemptRecord[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const refresh = () => setAttempts(listAttempts());
    refresh();
    // Same-tab save (custom event), other-tab save (native storage), and
    // return-to-tab — all should re-read so the numbers never go stale.
    window.addEventListener(ATTEMPTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(ATTEMPTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const a = useMemo(
    () => ({
      summary: summarize(attempts ?? []),
      trend: accuracyTrend(attempts ?? []),
      split: firstTryVsRetry(attempts ?? []),
      bySource: accuracyBySource(attempts ?? []),
      missed: mostMissed(attempts ?? []),
      weak: weakItemsDue(attempts ?? []),
    }),
    [attempts],
  );

  // Hide "by source" when it carries no signal (a single Ungrouped bucket just
  // restates overall accuracy).
  const showBySource =
    a.bySource.length > 1 || (a.bySource.length === 1 && a.bySource[0].source !== "Ungrouped");

  if (attempts === null) {
    return (
      <div className="flex justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Your progress</h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Take a quiz and your study history shows up here — accuracy over time, your weakest
          topics, and the questions to review next.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
            <BarChart className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-700">No attempts yet</p>
            <p className="mt-1 text-sm text-neutral-400">
              Finish a quiz and we&rsquo;ll start tracking how you&rsquo;re doing.
            </p>
          </div>
          <a
            href="/library"
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Play /> Study a quiz
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Your progress</h1>
          <p className="mt-2 text-[15px] text-neutral-500">
            Everything below is from your own study history on this device.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/stats/guide"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Target className="h-4 w-4" /> Study guide
          </a>
          {confirmClear ? (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-sm text-neutral-600">Clear all history?</span>
              <button
                type="button"
                onClick={() => {
                  clearAttempts();
                  setConfirmClear(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                <Trash className="h-4 w-4" /> Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <Trash className="h-4 w-4" /> Clear history
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Quizzes taken" value={a.summary.attempts} />
        <StatCard label="Questions answered" value={a.summary.questionsAnswered} />
        <StatCard
          label="Overall accuracy"
          value={<span className={textTone(a.summary.accuracy)}>{pct(a.summary.accuracy)}</span>}
          sub={`${a.summary.correct} of ${a.summary.questionsAnswered} correct`}
        />
        <StatCard
          label="Time studied"
          value={formatDuration(a.summary.totalTimeMs)}
          sub={
            a.summary.avgPerQuestionMs != null
              ? `~${formatDuration(a.summary.avgPerQuestionMs)} per question`
              : undefined
          }
        />
      </div>

      {/* Accuracy trend */}
      <div className="mt-6">
        <Section
          title="Accuracy over time"
          desc="Each bar is one finished run, oldest to newest."
        >
          <TrendChart points={a.trend} />
        </Section>
      </div>

      {/* First-try vs retry + accuracy by source */}
      <div className={cx("mt-6 grid gap-6", showBySource ? "lg:grid-cols-2" : "")}>
        <Section
          title="First try vs. after retry"
          desc="Whether revisiting your misses is paying off."
        >
          <div className="space-y-4">
            <ProgressRow
              label="First try"
              accuracy={a.split.firstTry.accuracy}
              correct={a.split.firstTry.correct}
              total={a.split.firstTry.total}
              tone="bg-neutral-900"
            />
            {a.split.retry.total > 0 ? (
              <ProgressRow
                label="After retry"
                accuracy={a.split.retry.accuracy}
                correct={a.split.retry.correct}
                total={a.split.retry.total}
                tone="bg-emerald-500"
              />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-neutral-400">
                <Restart className="h-4 w-4" /> No &ldquo;retry wrong&rdquo; runs yet — retry your
                misses after a quiz to compare.
              </p>
            )}
          </div>
        </Section>

        {showBySource && (
          <Section title="Accuracy by source" desc="Weakest first — where to focus next.">
            <div className="space-y-3">
              {a.bySource.map((s) => (
                <ProgressRow
                  key={s.source}
                  label={s.source}
                  accuracy={s.accuracy}
                  correct={s.correct}
                  total={s.total}
                  tone={barTone(s.accuracy)}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Review lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Due for review"
          desc="Shaky items worth another look — a light spaced-repetition nudge."
        >
          <QuestionList
            items={a.weak}
            emptyIcon={<Alert className="h-5 w-5" />}
            emptyText="Nothing flagged — your recent answers are holding up."
          />
        </Section>

        <Section title="Most missed" desc="The questions you get wrong most often.">
          <QuestionList
            items={a.missed}
            emptyIcon={<Alert className="h-5 w-5" />}
            emptyText="No misses recorded yet. Nice."
          />
        </Section>
      </div>
    </div>
  );
}

/** One headline number with a label and optional caption. */
function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

/** A titled white card section. */
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Label + a horizontal accuracy bar + correct/total — used for both the
 *  first-try/retry split and the per-source breakdown. */
function ProgressRow({
  label,
  accuracy,
  correct,
  total,
  tone,
}: {
  label: string;
  accuracy: number | null;
  correct: number;
  total: number;
  tone: string;
}) {
  const width = accuracy == null ? 0 : Math.round(accuracy * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-neutral-700">{label}</span>
        <span className="shrink-0 tabular-nums text-neutral-900">
          {pct(accuracy)}{" "}
          <span className="text-neutral-400">
            ({correct}/{total})
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={cx("h-full rounded-full transition-all", tone)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** The accuracy-per-attempt bar chart. Bars are colored by accuracy and capped
 *  to the most recent runs so the row stays legible. A dashed 50% reference line
 *  sits behind. Robust for any count (even a single attempt). */
function TrendChart({ points }: { points: TrendPoint[] }) {
  const recent = points.slice(-40);
  if (recent.length === 0) {
    return <p className="text-sm text-neutral-400">No graded runs yet.</p>;
  }
  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200" />
        <div className="relative flex h-40 items-end justify-start gap-1">
          {recent.map((p) => (
            <div
              key={p.id}
              title={`${p.quizTitle} · ${pct(p.accuracy)} · ${formatDate(p.finishedAt)}`}
              className="flex h-full max-w-[40px] flex-1 items-end"
            >
              <div
                className={cx("w-full rounded-t-sm transition-all", barTone(p.accuracy))}
                style={{ height: `${Math.max(3, Math.round(p.accuracy * 100))}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
        <span>{formatDate(recent[0].finishedAt)}</span>
        <span>{recent.length === 1 ? "1 run" : `${recent.length} runs`}</span>
        <span>{formatDate(recent[recent.length - 1].finishedAt)}</span>
      </div>
    </div>
  );
}

/** A list of question stats (most-missed / due-for-review), with an empty state. */
function QuestionList({
  items,
  emptyIcon,
  emptyText,
}: {
  items: QuestionStat[];
  emptyIcon: ReactNode;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-400">
          {emptyIcon}
        </span>
        <p className="text-sm text-neutral-400">{emptyText}</p>
      </div>
    );
  }
  return (
    <ul className="-my-2 divide-y divide-neutral-100">
      {items.map((q) => (
        <li key={q.questionId} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-snug text-neutral-700">{q.stem}</p>
            {q.sourceLabel && (
              <p className="mt-0.5 truncate text-xs text-neutral-400">{q.sourceLabel}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className={cx("text-sm font-medium tabular-nums", textTone(1 - q.missRate))}>
              {pct(q.missRate)} missed
            </div>
            <div className="text-xs text-neutral-400">
              {q.wrong}/{q.seen} {q.seen === 1 ? "attempt" : "attempts"}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
