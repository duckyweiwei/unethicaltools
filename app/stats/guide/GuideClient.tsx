"use client";

/**
 * Study guide (/stats/guide) — a prescriptive plan built client-side from the
 * localStorage attempt history (lib/storage/attempts.ts → studyGuide()). Reads
 * once on mount and refreshes on the same signals as the dashboard. Laid out as
 * a clean document: a snapshot line, an ordered list of next actions, focus
 * areas, and the exact questions to review. "Print / Save as PDF" uses the
 * browser's print (the global @media print rules strip the site chrome).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  listAttempts,
  studyGuide,
  MASTERY_TARGET,
  ATTEMPTS_EVENT,
  type AttemptRecord,
  type StudyGuide,
  type StudyAction,
  type QuestionStat,
} from "@/lib/storage/attempts";
import {
  Printer,
  Target,
  Restart,
  Alert,
  Check,
  Play,
  ChevronLeft,
  BarChart,
} from "@/components/quiz-editor/icons";

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** 0..1 → "73%", null → "—". */
function pct(x: number | null | undefined): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

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

/** Accuracy → bar/text tone (green good, amber middling, rose weak). */
function barTone(x: number | null): string {
  if (x == null) return "bg-neutral-200";
  if (x >= 0.8) return "bg-emerald-500";
  if (x >= 0.5) return "bg-amber-400";
  return "bg-rose-400";
}
function textTone(x: number | null): string {
  if (x == null) return "text-neutral-400";
  if (x >= 0.8) return "text-emerald-600";
  if (x >= 0.5) return "text-amber-600";
  return "text-rose-600";
}

/** Action urgency → chip colour. `print-exact` keeps it inked when printed. */
function actionChip(tone: StudyAction["tone"]): string {
  switch (tone) {
    case "high":
      return "bg-rose-100 text-rose-700";
    case "medium":
      return "bg-amber-100 text-amber-700";
    case "good":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-neutral-200 text-neutral-700";
  }
}

export function GuideClient() {
  const [attempts, setAttempts] = useState<AttemptRecord[] | null>(null);

  useEffect(() => {
    const refresh = () => setAttempts(listAttempts());
    refresh();
    window.addEventListener(ATTEMPTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(ATTEMPTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const guide: StudyGuide | null = useMemo(
    () => (attempts ? studyGuide(attempts) : null),
    [attempts],
  );

  // Most-missed items that aren't already in the review queue, so the two lists
  // don't repeat the same questions.
  const missedExtra = useMemo(() => {
    if (!guide) return [];
    const inReview = new Set(guide.review.map((q) => q.questionId));
    return guide.missed.filter((q) => !inReview.has(q.questionId));
  }, [guide]);

  const generated = useMemo(
    () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    [],
  );

  if (attempts === null || guide === null) {
    return (
      <div className="flex justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Your study guide</h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Once you&rsquo;ve taken a few quizzes, this page turns your results into a plan — what to
          focus on, the exact questions to review, and what to do next.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
            <BarChart className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-700">Nothing to build a guide from yet</p>
            <p className="mt-1 text-sm text-neutral-400">
              Finish a quiz or two and your personalised plan appears here.
            </p>
          </div>
          <Link
            href="/library"
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Play /> Study a quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="study-guide print-exact mx-auto max-w-3xl px-6 py-12">
      {/* Header + actions (actions hidden when printing) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Your study guide
          </h1>
          <p className="mt-2 text-[15px] text-neutral-500">
            A plan built from your study history on this device — work top to bottom.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link
            href="/stats"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <ChevronLeft /> Progress
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Snapshot line */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm">
        <Snapshot label="Overall accuracy" value={<span className={textTone(guide.overall.accuracy)}>{pct(guide.overall.accuracy)}</span>} />
        <Snapshot label="Questions answered" value={guide.overall.questionsAnswered} />
        <Snapshot label="Quizzes taken" value={guide.overall.attempts} />
        <Snapshot label="Time studied" value={formatDuration(guide.overall.totalTimeMs)} />
      </div>

      {guide.sparse && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Alert className="mt-0.5 h-4 w-4 shrink-0" />
          This guide gets more accurate the more you study — you&rsquo;ve only logged a little so
          far, so treat it as a starting point.
        </p>
      )}

      {/* 1. Next actions — the heart of the guide */}
      <GuideSection icon={<Target className="h-4 w-4" />} title="Do this next" desc="Your highest-impact moves, in order.">
        <ol className="space-y-3">
          {guide.actions.map((act, i) => (
            <li
              key={act.id}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <span
                className={cx(
                  "print-exact mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  actionChip(act.tone),
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{act.text}</p>
                {act.detail && <p className="mt-0.5 text-sm text-neutral-500">{act.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </GuideSection>

      {/* 2. Focus areas (by source) */}
      {(guide.focus.length > 0 || guide.strong.length > 0) && (
        <GuideSection
          icon={<BarChart className="h-4 w-4" />}
          title="Focus areas"
          desc={`Accuracy by source — aim to get each above ${pct(MASTERY_TARGET)}.`}
        >
          {guide.focus.length > 0 ? (
            <div className="space-y-3">
              {guide.focus.map((s) => (
                <div key={s.source}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-neutral-700">{s.source}</span>
                    <span className="shrink-0 tabular-nums text-neutral-900">
                      {pct(s.accuracy)}{" "}
                      <span className="text-neutral-400">
                        ({s.correct}/{s.total})
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={cx("print-exact h-full rounded-full", barTone(s.accuracy))}
                      style={{ width: `${Math.round(s.accuracy * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No weak sources — every source you&rsquo;ve studied is above {pct(MASTERY_TARGET)}.
            </p>
          )}

          {guide.strong.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Already solid
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {guide.strong.map((s) => (
                  <span
                    key={s.source}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 print-exact"
                  >
                    <Check className="h-3 w-3" /> {s.source} · {pct(s.accuracy)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </GuideSection>
      )}

      {/* 3. Questions to review */}
      <GuideSection
        icon={<Restart className="h-4 w-4" />}
        title="Review these next"
        desc="The shaky questions worth another pass."
      >
        {guide.review.length > 0 ? (
          <QuestionList items={guide.review} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Check className="h-4 w-4 text-emerald-500" /> Nothing flagged — your recent answers
            are holding up.
          </p>
        )}

        {missedExtra.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Also frequently missed
            </p>
            <div className="mt-2">
              <QuestionList items={missedExtra} />
            </div>
          </div>
        )}
      </GuideSection>

      {/* CTA (hidden when printing) */}
      <div className="no-print mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          <Play /> Study a quiz
        </Link>
        <span className="text-sm text-neutral-400">
          Re-run a quiz and use &ldquo;Retry wrong&rdquo; or Flashcards on these items.
        </span>
      </div>

      {/* Print/document footer */}
      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        Generated {generated} from {guide.overall.attempts}{" "}
        {guide.overall.attempts === 1 ? "quiz" : "quizzes"} on this device · unethicaltools. Your
        study history never leaves your browser.
      </p>
    </div>
  );
}

/** One label/value pair on the snapshot line. */
function Snapshot({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">{value}</div>
    </div>
  );
}

/** A titled section with an icon header — the guide's repeating block. */
function GuideSection({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-neutral-900 text-white print-exact">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
          {desc && <p className="text-xs text-neutral-500">{desc}</p>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A list of question stats with miss rate — shared by the review/missed lists. */
function QuestionList({ items }: { items: QuestionStat[] }) {
  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {items.map((q) => (
        <li key={q.questionId} className="flex items-start justify-between gap-3 px-4 py-3">
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
