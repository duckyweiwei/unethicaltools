"use client";

import { useMemo, useState } from "react";
import type { Quiz, Question, QuestionOption } from "@/lib/domain/types";
import { canScrambleNumbers, tryScrambleNumbers } from "@/lib/study/number-scramble";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Close,
  Folder,
  Hash,
  Play,
  Restart,
  Shuffle,
} from "@/components/quiz-editor/icons";

const LETTERS = "ABCDEFGHIJ".split("");

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle a question's options and re-letter A,B,C…, remapping `correct`. */
function shuffleOptions(q: Question): Question {
  const correctOpt =
    q.correct != null ? q.options.find((o) => o.label === q.correct) : undefined;
  const order = shuffle(q.options);
  const options: QuestionOption[] = order.map((o, i) => ({
    label: LETTERS[i] ?? o.label,
    text: o.text,
  }));
  const correct = correctOpt ? options[order.indexOf(correctOpt)]?.label ?? null : null;
  return { ...q, options, correct };
}

type Mode = "page" | "step";
type Phase = "setup" | "running" | "results";

/**
 * Source-agnostic quiz player. Takes any `Quiz` and lets you take it as a test:
 * pick the format — all-on-one-page (graded at the end) or one-at-a-time
 * (checked after each question) — scramble on/off, and how many questions, then
 * get scored with each question reviewed. Only questions that have a detected
 * correct answer are playable; the rest are surfaced as "skipped" so you can go
 * fix them in the editor.
 */
export function QuizPlayer({
  quiz,
  onExit,
  exitLabel = "Exit",
}: {
  quiz: Quiz;
  onExit: () => void;
  exitLabel?: string;
}) {
  const playable = useMemo(
    () => quiz.questions.filter((q) => q.options.length >= 2 && q.correct != null),
    [quiz],
  );
  const skipped = quiz.questions.length - playable.length;

  const [mode, setMode] = useState<Mode>("page");
  const [scramble, setScramble] = useState(true);
  const [scrambleNums, setScrambleNums] = useState(false);
  const [count, setCount] = useState(Math.max(1, playable.length));

  // Distinct source PDFs in this quiz (set when merged from multiple uploads).
  // The "Show source" study toggle only makes sense across >=2 sources, since
  // once questions are scrambled together you can't tell which file each is from.
  const sources = useMemo(
    () => [...new Set(playable.map((q) => q.sourceLabel).filter(Boolean))] as string[],
    [playable],
  );
  const multiSource = sources.length >= 2;
  const [showSource, setShowSource] = useState(false);

  // "Scramble numbers" is only offered when at least one question is a
  // verifiable arithmetic MCQ we can regenerate; otherwise it would do nothing.
  const numEligible = useMemo(() => playable.some(canScrambleNumbers), [playable]);

  // One-at-a-time runs check each answer as you go; all-on-one-page defers all
  // grading to the results screen. Feedback timing follows the format, so it's
  // derived from `runMode` rather than a separate toggle.
  const [phase, setPhase] = useState<Phase>("setup");
  const [test, setTest] = useState<Question[]>([]);
  const [runMode, setRunMode] = useState<Mode>("page");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(0);

  function start() {
    let qs = scramble ? shuffle(playable) : [...playable];
    qs = qs.slice(0, Math.max(1, Math.min(count, qs.length)));
    // Fresh-numbers variant (one-time, per run): regenerate arithmetic questions
    // we can verify, leaving everything else as-is. Done before option shuffle so
    // labels/correct are intact when it runs.
    if (scrambleNums) qs = qs.map((x) => tryScrambleNumbers(x) ?? x);
    if (scramble) qs = qs.map(shuffleOptions);
    setTest(qs);
    setRunMode(mode);
    setAnswers({});
    setStepIdx(0);
    setPhase("running");
  }

  /** Re-run just the questions missed last time, keeping the same format.
   *  Order is reshuffled when scramble is on. */
  function retryWrong(wrongQs: Question[]) {
    setTest(scramble ? shuffle(wrongQs) : [...wrongQs]);
    setAnswers({});
    setStepIdx(0);
    setPhase("running");
  }

  // One-at-a-time locks an answer once chosen (so the reveal stays honest);
  // all-on-one-page leaves every answer changeable until you submit.
  const choose = (qid: string, label: string) => {
    if (runMode === "step" && answers[qid] != null) return;
    setAnswers((a) => ({ ...a, [qid]: label }));
  };

  const Header = (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <span className="truncate text-sm font-medium text-neutral-700">{quiz.title}</span>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
      >
        <Close className="h-4 w-4" />
        {exitLabel}
      </button>
    </header>
  );

  // ---- Setup ----
  if (phase === "setup") {
    return (
      <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
        {Header}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-6">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Set up your test</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {playable.length} question{playable.length === 1 ? "" : "s"} ready
                {skipped > 0 && ` · ${skipped} skipped (no answer set)`}
              </p>

              {playable.length === 0 ? (
                <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  None of these questions have a correct answer yet. Set the answers in the
                  editor first, then come back to study.
                </div>
              ) : (
                <>
                  <div className="mt-6 text-sm font-medium text-neutral-700">Format</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("page")}
                      className={cx(
                        "rounded-xl border p-3 text-left transition",
                        mode === "page"
                          ? "border-neutral-900 ring-1 ring-neutral-900"
                          : "border-neutral-200 hover:border-neutral-300",
                      )}
                    >
                      <div className="text-sm font-medium text-neutral-900">All on one page</div>
                      <div className="mt-0.5 text-xs text-neutral-500">Answer all — graded at the end</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("step")}
                      className={cx(
                        "rounded-xl border p-3 text-left transition",
                        mode === "step"
                          ? "border-neutral-900 ring-1 ring-neutral-900"
                          : "border-neutral-200 hover:border-neutral-300",
                      )}
                    >
                      <div className="text-sm font-medium text-neutral-900">One at a time</div>
                      <div className="mt-0.5 text-xs text-neutral-500">See if you&apos;re right after each question</div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScramble((s) => !s)}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:border-neutral-300"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                      <Shuffle className="h-4 w-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-neutral-900">Scramble</span>
                      <span className="block text-xs text-neutral-500">Shuffle question &amp; answer order</span>
                    </span>
                    <span
                      className={cx(
                        "relative h-6 w-10 shrink-0 rounded-full transition",
                        scramble ? "bg-neutral-900" : "bg-neutral-200",
                      )}
                    >
                      <span
                        className={cx(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                          scramble ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </span>
                  </button>

                  {numEligible && (
                    <button
                      type="button"
                      onClick={() => setScrambleNums((s) => !s)}
                      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:border-neutral-300"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                        <Hash className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-neutral-900">Scramble numbers</span>
                        <span className="block text-xs text-neutral-500">
                          Generate fresh numbers &amp; recompute the answer — a new test each time
                        </span>
                      </span>
                      <span
                        className={cx(
                          "relative h-6 w-10 shrink-0 rounded-full transition",
                          scrambleNums ? "bg-neutral-900" : "bg-neutral-200",
                        )}
                      >
                        <span
                          className={cx(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                            scrambleNums ? "left-[18px]" : "left-0.5",
                          )}
                        />
                      </span>
                    </button>
                  )}

                  {multiSource && (
                    <button
                      type="button"
                      onClick={() => setShowSource((s) => !s)}
                      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:border-neutral-300"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                        <Folder className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-neutral-900">Show source</span>
                        <span className="block text-xs text-neutral-500">
                          Label each question with the PDF it came from ({sources.length} sources)
                        </span>
                      </span>
                      <span
                        className={cx(
                          "relative h-6 w-10 shrink-0 rounded-full transition",
                          showSource ? "bg-neutral-900" : "bg-neutral-200",
                        )}
                      >
                        <span
                          className={cx(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                            showSource ? "left-[18px]" : "left-0.5",
                          )}
                        />
                      </span>
                    </button>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">Questions</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={playable.length}
                        value={count}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setCount(Number.isNaN(n) ? 1 : Math.max(1, Math.min(playable.length, n)));
                        }}
                        className="w-20 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
                      />
                      <button
                        type="button"
                        onClick={() => setCount(playable.length)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition hover:text-neutral-900"
                      >
                        All ({playable.length})
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={start}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    <Play /> Start test
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Results ----
  if (phase === "results") {
    const graded = test.map((q) => {
      const chosen = answers[q.id] ?? null;
      return { q, chosen, correct: chosen != null && chosen === q.correct };
    });
    const score = graded.filter((g) => g.correct).length;
    const pct = test.length ? Math.round((score / test.length) * 100) : 0;
    const wrong = graded.filter((g) => !g.correct).map((g) => g.q);

    return (
      <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
        {Header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
              <div className="text-sm font-medium text-neutral-500">Your score</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight">{pct}%</div>
              <div className="mt-1 text-sm text-neutral-500">
                {score} of {test.length} correct
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {wrong.length > 0 && (
                  <button
                    type="button"
                    onClick={() => retryWrong(wrong)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    <Restart className="h-4 w-4" /> Retry wrong ({wrong.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPhase("setup")}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition",
                    wrong.length > 0
                      ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                      : "bg-neutral-900 text-white hover:bg-neutral-700",
                  )}
                >
                  <Restart className="h-4 w-4" /> Retake
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  {exitLabel}
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {graded.map(({ q, chosen, correct }, i) => (
                <div key={q.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Question {i + 1}
                      </span>
                      {showSource && q.sourceLabel && <SourceBadge label={q.sourceLabel} />}
                    </div>
                    <span
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {correct ? "Correct" : chosen == null ? "Skipped" : "Incorrect"}
                    </span>
                  </div>
                  <div className="mt-2 whitespace-pre-line text-[15px] font-medium text-neutral-900">
                    {q.stem}
                  </div>
                  <div className="mt-4 space-y-2">
                    {q.options.map((o) => {
                      const isCorrect = o.label === q.correct;
                      const isChosen = o.label === chosen;
                      return (
                        <div
                          key={o.label}
                          className={cx(
                            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                            isCorrect
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : isChosen
                                ? "border-rose-200 bg-rose-50 text-rose-900"
                                : "border-neutral-200 text-neutral-600",
                          )}
                        >
                          <span className="w-5 shrink-0 text-center text-xs font-semibold text-neutral-400">
                            {o.label}
                          </span>
                          <span className="flex-1">{o.text}</span>
                          {isCorrect && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                          {isChosen && !isCorrect && <Close className="h-4 w-4 shrink-0 text-rose-500" />}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="mt-3 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      <span className="font-medium text-neutral-700">Why: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Running ----
  const total = test.length;

  if (runMode === "page") {
    const answered = test.filter((q) => answers[q.id] != null).length;
    return (
      <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
        {Header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            {test.map((q, i) => (
              <div key={q.id} className="mb-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Question {i + 1} of {total}
                  </div>
                  {showSource && q.sourceLabel && <SourceBadge label={q.sourceLabel} />}
                </div>
                <div className="mt-2 whitespace-pre-line text-[15px] font-medium text-neutral-900">
                  {q.stem}
                </div>
                <div className="mt-4 space-y-2">
                  {q.options.map((o) => (
                    <OptionButton
                      key={o.label}
                      label={o.label}
                      text={o.text}
                      selected={answers[q.id] === o.label}
                      onClick={() => choose(q.id, o.label)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <span className="text-sm text-neutral-500">
              {answered} of {total} answered
            </span>
            <button
              type="button"
              onClick={() => setPhase("results")}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Submit test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step mode
  const q = test[stepIdx];
  const isLast = stepIdx === total - 1;
  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
      {Header}
      <div className="h-1 w-full bg-neutral-100">
        <div
          className="h-full bg-neutral-900 transition-all"
          style={{ width: `${((stepIdx + 1) / total) * 100}%` }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Question {stepIdx + 1} of {total}
              </div>
              {showSource && q.sourceLabel && <SourceBadge label={q.sourceLabel} />}
            </div>
            <div className="mt-2 whitespace-pre-line text-[15px] font-medium text-neutral-900">
              {q.stem}
            </div>
            <div className="mt-4 space-y-2">
              {q.options.map((o) => (
                <OptionButton
                  key={o.label}
                  label={o.label}
                  text={o.text}
                  selected={answers[q.id] === o.label}
                  onClick={() => choose(q.id, o.label)}
                  revealed={answers[q.id] != null}
                  isCorrect={o.label === q.correct}
                  disabled={answers[q.id] != null}
                />
              ))}
            </div>
            {answers[q.id] != null && (
              <FeedbackNote correct={answers[q.id] === q.correct} explanation={q.explanation} />
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            <ChevronLeft /> Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => setPhase("results")}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Next <ChevronRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small provenance pill: which PDF a question came from. Shown in study mode
 *  only when "Show source" is on and the quiz spans multiple sources. */
function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
      <Folder className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function OptionButton({
  label,
  text,
  selected,
  onClick,
  revealed = false,
  isCorrect = false,
  disabled = false,
}: {
  label: string;
  text: string;
  selected: boolean;
  onClick: () => void;
  revealed?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}) {
  // When an answer is revealed (one-at-a-time mode), the correct option turns
  // green, a wrong pick turns red, and the rest dim out.
  const showCorrect = revealed && isCorrect;
  const showWrong = revealed && selected && !isCorrect;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
        disabled && "cursor-default",
        showCorrect
          ? "border-emerald-300 bg-emerald-50"
          : showWrong
            ? "border-rose-300 bg-rose-50"
            : selected
              ? "border-neutral-900 bg-neutral-900/5 ring-1 ring-neutral-900"
              : revealed
                ? "border-neutral-200 opacity-60"
                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
      )}
    >
      <span
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition",
          showCorrect
            ? "border-emerald-500 bg-emerald-500 text-white"
            : showWrong
              ? "border-rose-500 bg-rose-500 text-white"
              : selected
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-400",
        )}
      >
        {label}
      </span>
      <span
        className={cx(
          "flex-1",
          showCorrect
            ? "font-medium text-emerald-900"
            : showWrong
              ? "font-medium text-rose-900"
              : selected
                ? "font-medium text-neutral-900"
                : "text-neutral-700",
        )}
      >
        {text}
      </span>
      {showCorrect && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
      {showWrong && <Close className="h-4 w-4 shrink-0 text-rose-500" />}
    </button>
  );
}

/** Inline verdict shown beneath a question in one-at-a-time mode, with the
 *  explanation (if any) so you learn the moment you answer. */
function FeedbackNote({
  correct,
  explanation,
}: {
  correct: boolean;
  explanation: string | null;
}) {
  return (
    <div
      className={cx(
        "mt-3 rounded-lg px-4 py-3 text-sm",
        correct ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
      )}
    >
      <span className="font-semibold">{correct ? "Correct" : "Not quite"}</span>
      {explanation && <span className="opacity-80"> — {explanation}</span>}
    </div>
  );
}
