"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Quiz, Question, QuestionOption, QuestionImage } from "@/lib/domain/types";
import {
  usesAnswerText,
  isMultiSelect,
  decodeChoice,
  encodeChoice,
  gradeMcq,
} from "@/lib/domain/types";
import { canScrambleNumbers, tryScrambleNumbers } from "@/lib/study/number-scramble";
import { fillBlank, type FilledBlank } from "@/lib/study/cloze";
import { primeAudio, playCorrect, playWrong, playDone } from "@/lib/study/sound";
import { useImage } from "@/lib/storage/image-store";
import { saveAttempt } from "@/lib/storage/attempts";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Close,
  Folder,
  Hash,
  Layers,
  Play,
  Restart,
  Shuffle,
  Star,
  SwapVertical,
  Volume,
  VolumeOff,
} from "@/components/quiz-editor/icons";

const LETTERS = "ABCDEFGHIJ".split("");

// Self-grade verdicts for short-answer ("open") questions. Stored in the same
// `answers` map as MCQ option labels; the sentinels can't collide with a label.
const RIGHT = "__right__";
const WRONG = "__wrong__";

// Persisted across sessions so a learner's mute choice sticks. Sound is on by
// default; storing the string "off" mutes it.
const SOUND_KEY = "pdfquiz:sound";

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** The image attached to a question's stem, if any. Resolves the bytes lazily
 *  from IndexedDB; renders nothing while loading or when the reference is stale,
 *  so a missing image degrades to a text-only question rather than a broken icon. */
function StemImage({ q }: { q: Question }) {
  const url = useImage(q.image?.id);
  if (!q.image || !url) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- dataURL from IndexedDB, nothing for next/image to optimize */
    <img
      src={url}
      alt={q.image.alt?.trim() || q.stem.trim() || "Question image"}
      className="mt-3 max-h-80 w-auto rounded-xl border border-neutral-200 object-contain"
    />
  );
}

/** A picture attached to ONE answer choice (image-per-answer questions, where the
 *  choice itself is a figure). Resolves the bytes lazily from IndexedDB and, like
 *  StemImage, renders nothing while loading or when the reference is stale — so a
 *  missing image degrades to the option's text/letter rather than a broken icon. */
function OptionImage({ image, alt }: { image?: QuestionImage | null; alt: string }) {
  const url = useImage(image?.id);
  if (!image || !url) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- dataURL from IndexedDB, nothing for next/image to optimize */
    <img
      src={url}
      alt={alt}
      className="mt-1 block max-h-44 w-auto rounded-md border border-neutral-200 object-contain"
    />
  );
}

/** A question is playable if it can be graded: an MCQ (or True/False) with a
 *  marked answer, or a self-graded short-answer / fill-in-the-blank with a
 *  reference answer to grade against. */
function isPlayable(q: Question): boolean {
  return usesAnswerText(q)
    ? !!(q.answerText && q.answerText.trim())
    : q.options.length >= 2 && q.correct != null;
}

/** The filled-in sentence for a cloze question (answer dropped into its blank),
 *  or null for any other type / when there's no blank to fill. */
function clozeFill(q: Question): FilledBlank | null {
  return q.type === "cloze" ? fillBlank(q.stem, q.answerText ?? "") : null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle a question's options and re-letter A,B,C…, remapping `correct` (and
 *  `correctSet` for multi-select) onto the new labels via an old→new map. */
function shuffleOptions(q: Question): Question {
  const order = shuffle(q.options);
  const options: QuestionOption[] = order.map((o, i) => ({
    label: LETTERS[i] ?? o.label,
    text: o.text,
    // Keep any per-option image (image-per-answer questions) pinned to its choice
    // as it moves; only the visible letter changes.
    ...(o.image ? { image: o.image } : {}),
  }));
  // Old label → new label, by position after the shuffle.
  const remap = new Map<string, string>();
  order.forEach((o, i) => remap.set(o.label, options[i].label));
  const correct = q.correct != null ? remap.get(q.correct) ?? null : null;
  const correctSet = q.correctSet
    ? (q.correctSet.map((l) => remap.get(l)).filter(Boolean) as string[])
    : q.correctSet;
  return { ...q, options, correct, correctSet };
}

type Mode = "page" | "step" | "flash";
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
  inShell = false,
}: {
  quiz: Quiz;
  onExit: () => void;
  exitLabel?: string;
  /** Rendered inside the global app shell (the /play route) rather than as a
   *  standalone, full-viewport surface (the editor's preview overlay). In shell
   *  mode the global top toolbar already handles navigation, so the player shows
   *  only a slim context line instead of its own full bar — no double bar — and
   *  fits the height left under that toolbar. */
  inShell?: boolean;
}) {
  const playable = useMemo(() => quiz.questions.filter(isPlayable), [quiz]);
  const skipped = quiz.questions.length - playable.length;

  const [mode, setMode] = useState<Mode>("page");
  const [scramble, setScramble] = useState(true);
  // Answer-choice shuffle is its own toggle (decoupled from question-order
  // scramble) so you can keep questions in their original order — handy when
  // studying alongside the source paper — while still randomising the options.
  const [scrambleOpts, setScrambleOpts] = useState(true);
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

  // "Shuffle answers" only applies to multiple-choice questions; only offer it
  // when the playable set actually has one (open/cloze items have no options).
  const optsEligible = useMemo(
    () => playable.some((q) => !usesAnswerText(q) && q.options.length >= 2),
    [playable],
  );

  // One-at-a-time runs check each answer as you go; all-on-one-page defers all
  // grading to the results screen. Feedback timing follows the format, so it's
  // derived from `runMode` rather than a separate toggle.
  const [phase, setPhase] = useState<Phase>("setup");
  const [test, setTest] = useState<Question[]>([]);
  const [runMode, setRunMode] = useState<Mode>("page");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(0);
  // Flashcards: whether the current card is showing its answer side. Reset on
  // every card change (navigation, start, retry) so each card opens question-up.
  const [flipped, setFlipped] = useState(false);
  // One-at-a-time grades only after an explicit "Check", so a picked-but-not-yet
  // checked answer stays changeable. `checked[qid]` flips on Check and locks it.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Short-answer questions reveal their reference answer before self-grading;
  // `revealed[qid]` tracks that, independent of the MCQ `checked` lock.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  // Flashcards: cards the learner explicitly stars to revisit, independent of the
  // known/still-learning verdict. A card can be "known" yet still marked (e.g.
  // "got it, but check the wording later"). Drives the "Review N marked" retry on
  // the results screen, mirroring the wrong-answer retry. Reset each run.
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Audio cues for right/wrong answers (and a finish flourish). On by default;
  // the learner's mute choice persists. Read once on mount to avoid an SSR
  // mismatch (localStorage is client-only).
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      /* storage blocked — keep the default */
    }
  }, []);
  function toggleSound() {
    setSoundOn((on) => {
      const next = !on;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  // Fired at each grading gesture (Check / self-grade). Gated by the toggle.
  const feedback = (correct: boolean) => {
    if (!soundOn) return;
    if (correct) playCorrect();
    else playWrong();
  };

  // After submitting, snap the results view back to the top so the score is the
  // first thing you see. The scroll container is reused across phases, so it
  // would otherwise stay wherever you left the question list. Also plays the
  // "done" flourish — the only answer-feedback sound in all-on-one-page mode,
  // which defers grading to here.
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "results") return;
    resultsScrollRef.current?.scrollTo({ top: 0 });
    if (soundOn) playDone();
    // soundOn intentionally omitted: this should fire on the transition into
    // results, not when the mute toggle changes while already on the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Study-history timing. `runStartRef` is stamped when a run begins (start /
  // retry) and doubles as the run's key; `savedRunRef` guards the results-save
  // effect so each finished run is recorded exactly once (even under React's
  // dev double-invoke). `isRetryRunRef` tags the run as a "retry wrong" pass.
  const runStartRef = useRef<number>(0);
  const savedRunRef = useRef<number>(0);
  const isRetryRunRef = useRef<boolean>(false);

  // Record the finished run for the progress dashboard (/stats). Fires on the
  // transition into results; reads the frozen test + answers (grading is
  // read-only there) and persists a per-question breakdown. Save-once per run.
  useEffect(() => {
    if (phase !== "results") return;
    if (test.length === 0) return;
    if (savedRunRef.current === runStartRef.current) return;
    savedRunRef.current = runStartRef.current;

    const finished = Date.now();
    const started = runStartRef.current || finished;
    const items = test.map((q) => {
      const chosen = answers[q.id] ?? null;
      // Flashcards self-grade every card (any type) as known/again via the same
      // sentinels, so grade purely on that; tests grade by the question type.
      const correct =
        runMode === "flash"
          ? chosen === RIGHT
          : usesAnswerText(q)
            ? chosen === RIGHT
            : gradeMcq(q, chosen);
      return {
        questionId: q.id,
        stem: q.stem,
        type: q.type,
        sourceLabel: q.sourceLabel,
        correct,
        skipped: chosen == null,
      };
    });
    saveAttempt({
      quizId: quiz.id,
      quizTitle: quiz.title,
      mode: runMode,
      isRetry: isRetryRunRef.current,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: Math.max(0, finished - started),
      score: items.filter((i) => i.correct).length,
      total: items.length,
      items,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function start() {
    // Unlock audio on this click so cues are reliably audible later — including
    // the page-mode finish chime, which fires from an effect, not a click.
    if (soundOn) primeAudio();
    let qs = scramble ? shuffle(playable) : [...playable];
    qs = qs.slice(0, Math.max(1, Math.min(count, qs.length)));
    // Fresh-numbers variant (one-time, per run): regenerate arithmetic questions
    // we can verify, leaving everything else as-is. Done before option shuffle so
    // labels/correct are intact when it runs. Both option scrambles are skipped
    // in flashcards, where the answer is revealed directly (nothing to scramble).
    if (scrambleNums && mode !== "flash") qs = qs.map((x) => tryScrambleNumbers(x) ?? x);
    if (scrambleOpts && mode !== "flash") qs = qs.map(shuffleOptions);
    setTest(qs);
    setRunMode(mode);
    setAnswers({});
    setChecked({});
    setRevealed({});
    setMarkedForReview(new Set());
    setStepIdx(0);
    setFlipped(false);
    runStartRef.current = Date.now();
    isRetryRunRef.current = false;
    setPhase("running");
  }

  /** Re-run just the questions missed last time, keeping the same format.
   *  Order is reshuffled when scramble is on. */
  function retryWrong(wrongQs: Question[]) {
    let qs = scramble ? shuffle(wrongQs) : [...wrongQs];
    // Keep the same format as the run we're retrying (runMode is unchanged here),
    // so a flashcards retry stays flashcards — and skips the option shuffle.
    if (scrambleOpts && runMode !== "flash") qs = qs.map(shuffleOptions);
    setTest(qs);
    setAnswers({});
    setChecked({});
    setRevealed({});
    setMarkedForReview(new Set());
    setStepIdx(0);
    setFlipped(false);
    runStartRef.current = Date.now();
    isRetryRunRef.current = true;
    setPhase("running");
  }

  // One-at-a-time locks an answer once chosen (so the reveal stays honest);
  // all-on-one-page leaves every answer changeable until you submit.
  // Multi-select toggles the label in/out of the chosen set; emptying it drops
  // the key so the question reads as unanswered (skipped) rather than wrong.
  const choose = (qid: string, label: string) => {
    if (runMode === "step" && checked[qid]) return;
    const q = test.find((t) => t.id === qid);
    if (q && isMultiSelect(q)) {
      setAnswers((a) => {
        const cur = decodeChoice(a[qid]);
        const next = cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
        const copy = { ...a };
        if (next.length) copy[qid] = encodeChoice(next);
        else delete copy[qid];
        return copy;
      });
      return;
    }
    setAnswers((a) => ({ ...a, [qid]: label }));
  };

  // Short-answer self-grade: record the user's own verdict (changeable until the
  // test is submitted / they advance). Revealing the answer first is required by
  // the UI, so this only fires after the reference answer is on screen.
  const reveal = (qid: string) => setRevealed((r) => ({ ...r, [qid]: true }));
  const selfGrade = (qid: string, verdict: string) =>
    setAnswers((a) => ({ ...a, [qid]: verdict }));

  // Flashcards: move to a card and reset it to its question side.
  const gotoCard = (idx: number) => {
    setStepIdx(idx);
    setFlipped(false);
  };
  // Flashcards: record a known/again verdict for the current card, then advance —
  // or finish on the last card. A positive chime only on "known" so "still
  // learning" doesn't feel like a buzzer penalty.
  const rateCard = (qid: string, verdict: string) => {
    setAnswers((a) => ({ ...a, [qid]: verdict }));
    if (verdict === RIGHT) feedback(true);
    if (stepIdx >= test.length - 1) setPhase("results");
    else gotoCard(stepIdx + 1);
  };
  // Flashcards: star/unstar the current card for later review. Immutable update so
  // React sees a new Set reference and re-renders the toggle + results count.
  const toggleMark = (qid: string) =>
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });

  // Mute toggle — the one study control that must stay reachable mid-test, so it
  // lives in the player's chrome in both layouts.
  const soundToggle = (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Mute answer sounds" : "Unmute answer sounds"}
      title={soundOn ? "Sound on" : "Sound off"}
      className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
    >
      {soundOn ? <Volume className="h-4 w-4" /> : <VolumeOff className="h-4 w-4" />}
    </button>
  );

  // The player's own top chrome. Standalone (editor preview overlay) it's a full
  // bar: title · mute · exit. Inside the app shell the global toolbar already
  // carries navigation and an exit path, so a second nav-like bar would double
  // up — we drop to a slim context line (title · mute) that keeps mute reachable
  // without competing with the toolbar above it.
  const Header = inShell ? (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/80 px-4 backdrop-blur sm:px-6">
      <span className="truncate text-sm font-medium text-neutral-600">{quiz.title}</span>
      {soundToggle}
    </div>
  ) : (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <span className="truncate text-sm font-medium text-neutral-700">{quiz.title}</span>
      <div className="flex items-center gap-2">
        {soundToggle}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
        >
          <Close className="h-4 w-4" />
          {exitLabel}
        </button>
      </div>
    </header>
  );

  // Standalone the player owns the viewport; inside the shell it sits under the
  // global toolbar (h-14 = 3.5rem), so it fills the remaining height instead.
  // `dvh` keeps it correct against mobile browser chrome.
  const rootCls = cx(
    "flex flex-col bg-neutral-50 text-neutral-900",
    inShell ? "h-[calc(100dvh-3.5rem)]" : "h-screen",
  );

  // ---- Setup ----
  if (phase === "setup") {
    return (
      <div className={rootCls}>
        {Header}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-6">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                {mode === "flash" ? "Set up flashcards" : "Set up your test"}
              </h2>
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
                    onClick={() => setMode("flash")}
                    className={cx(
                      "mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      mode === "flash"
                        ? "border-neutral-900 ring-1 ring-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                      <Layers className="h-4 w-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-neutral-900">Flashcards</span>
                      <span className="block text-xs text-neutral-500">
                        Flip each card, then mark whether you knew it
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScramble((s) => !s)}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:border-neutral-300"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                      <Shuffle className="h-4 w-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-neutral-900">Shuffle questions</span>
                      <span className="block text-xs text-neutral-500">Mix up the order the questions appear in</span>
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

                  {mode !== "flash" && optsEligible && (
                    <button
                      type="button"
                      onClick={() => setScrambleOpts((s) => !s)}
                      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:border-neutral-300"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                        <SwapVertical className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-neutral-900">Shuffle answers</span>
                        <span className="block text-xs text-neutral-500">
                          Mix up the answer choices so the correct one isn&apos;t always in the same spot
                        </span>
                      </span>
                      <span
                        className={cx(
                          "relative h-6 w-10 shrink-0 rounded-full transition",
                          scrambleOpts ? "bg-neutral-900" : "bg-neutral-200",
                        )}
                      >
                        <span
                          className={cx(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                            scrambleOpts ? "left-[18px]" : "left-0.5",
                          )}
                        />
                      </span>
                    </button>
                  )}

                  {mode !== "flash" && numEligible && (
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
                    {mode === "flash" ? (
                      <>
                        <Layers className="h-4 w-4" /> Start flashcards
                      </>
                    ) : (
                      <>
                        <Play /> Start test
                      </>
                    )}
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
    // Flashcards get their own summary: how many you knew, and the deck of cards
    // you marked "still learning" — each shown with its answer to read through,
    // plus a one-tap retry of just that subset.
    if (runMode === "flash") {
      const known = test.filter((t) => answers[t.id] === RIGHT);
      const toReview = test.filter((t) => answers[t.id] !== RIGHT);
      const marked = test.filter((t) => markedForReview.has(t.id));
      const knownPct = test.length ? Math.round((known.length / test.length) * 100) : 0;
      return (
        <div className={rootCls}>
          {Header}
          <div ref={resultsScrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-8">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
                <div className="text-sm font-medium text-neutral-500">Cards you knew</div>
                <div className="mt-1 text-4xl font-semibold tracking-tight">
                  {known.length} / {test.length}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{knownPct}% known this round</div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {toReview.length > 0 && (
                    <button
                      type="button"
                      onClick={() => retryWrong(toReview)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
                    >
                      <Restart className="h-4 w-4" /> Review {toReview.length} again
                    </button>
                  )}
                  {marked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => retryWrong(marked)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                    >
                      <Star className="h-4 w-4" /> Review {marked.length} marked
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhase("setup")}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition",
                      toReview.length === 0 && marked.length === 0
                        ? "bg-neutral-900 text-white hover:bg-neutral-700"
                        : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    <Restart className="h-4 w-4" /> Study all again
                  </button>
                </div>
              </div>

              {marked.length > 0 && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
                    <Star className="h-4 w-4 text-amber-500" /> Marked for review ({marked.length})
                  </h3>
                  <div className="mt-3 space-y-3">
                    {marked.map((q, i) => (
                      <div
                        key={q.id}
                        className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            Card {i + 1}
                          </span>
                          {showSource && q.sourceLabel && <SourceBadge label={q.sourceLabel} />}
                        </div>
                        <div className="mt-2 whitespace-pre-line text-[15px] font-medium text-neutral-900">
                          {q.stem}
                        </div>
                        <StemImage q={q} />
                        <div className="mt-3">
                          <FlashAnswer q={q} />
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
              )}

              {toReview.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-neutral-700">
                    Still learning ({toReview.length})
                  </h3>
                  <div className="mt-3 space-y-3">
                    {toReview.map((q, i) => (
                      <div
                        key={q.id}
                        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            Card {i + 1}
                          </span>
                          {showSource && q.sourceLabel && <SourceBadge label={q.sourceLabel} />}
                        </div>
                        <div className="mt-2 whitespace-pre-line text-[15px] font-medium text-neutral-900">
                          {q.stem}
                        </div>
                        <StemImage q={q} />
                        <div className="mt-3">
                          <FlashAnswer q={q} />
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
              ) : (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="text-sm font-medium text-emerald-800">
                    You knew every card. Nice work.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const graded = test.map((q) => {
      const chosen = answers[q.id] ?? null;
      const correct = usesAnswerText(q) ? chosen === RIGHT : gradeMcq(q, chosen);
      return { q, chosen, correct };
    });
    const score = graded.filter((g) => g.correct).length;
    const pct = test.length ? Math.round((score / test.length) * 100) : 0;
    const wrong = graded.filter((g) => !g.correct).map((g) => g.q);

    return (
      <div className={rootCls}>
        {Header}
        <div ref={resultsScrollRef} className="min-h-0 flex-1 overflow-y-auto">
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
                  <StemImage q={q} />
                  {usesAnswerText(q) ? (
                    <OpenAnswerReview answer={q.answerText ?? ""} filled={clozeFill(q)} />
                  ) : (
                  <div className="mt-4 space-y-2">
                    {isMultiSelect(q) && <SelectAllHint />}
                    {(() => {
                      // For a multi-select item, "correct" and "chosen" are sets of
                      // labels; for a single-answer item they're at most one label.
                      const correctLabels = isMultiSelect(q)
                        ? new Set(q.correctSet ?? [])
                        : new Set([q.correct]);
                      const chosenLabels = isMultiSelect(q)
                        ? new Set(decodeChoice(chosen))
                        : new Set([chosen]);
                      return q.options.map((o) => {
                      const isCorrect = correctLabels.has(o.label);
                      const isChosen = chosenLabels.has(o.label);
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
                          <span className="min-w-0 flex-1">
                            {o.text && <span className="whitespace-pre-line">{o.text}</span>}
                            <OptionImage image={o.image} alt={o.text || `Option ${o.label}`} />
                          </span>
                          {isCorrect && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                          {isChosen && !isCorrect && <Close className="h-4 w-4 shrink-0 text-rose-500" />}
                        </div>
                      );
                      });
                    })()}
                  </div>
                  )}
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

  if (runMode === "flash") {
    const card = test[stepIdx];
    const isLastCard = stepIdx === total - 1;
    const verdict = answers[card.id];
    const knownCount = test.filter((t) => answers[t.id] === RIGHT).length;
    const reviewCount = test.filter((t) => answers[t.id] === WRONG).length;
    const isMarked = markedForReview.has(card.id);
    return (
      <div className={rootCls}>
        {Header}
        <div className="h-1 w-full bg-neutral-100">
          <div
            className="h-full bg-neutral-900 transition-all"
            style={{ width: `${((stepIdx + 1) / total) * 100}%` }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col px-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Card {stepIdx + 1} of {total}
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-emerald-600">{knownCount} known</span>
                <span className="text-amber-600">{reviewCount} to review</span>
                <button
                  type="button"
                  onClick={() => toggleMark(card.id)}
                  aria-pressed={isMarked}
                  aria-label={isMarked ? "Unmark this card" : "Mark this card for review"}
                  title={
                    isMarked
                      ? "Marked for review — tap to unmark"
                      : "Mark this card for review"
                  }
                  className={cx(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 transition",
                    isMarked
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                >
                  <Star className="h-3.5 w-3.5" /> {isMarked ? "Marked" : "Mark"}
                </button>
              </div>
            </div>

            {/* The card — tap anywhere to flip between question and answer. */}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="group mt-3 min-h-[18rem] w-full rounded-2xl border border-neutral-200 bg-white p-8 text-left shadow-sm transition hover:border-neutral-300"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {flipped ? "Answer" : "Question"}
                </span>
                {showSource && card.sourceLabel && <SourceBadge label={card.sourceLabel} />}
              </div>

              {!flipped ? (
                <div className="mt-4">
                  <div className="whitespace-pre-line text-lg font-medium text-neutral-900">
                    {card.stem}
                  </div>
                  <StemImage q={card} />
                  {!usesAnswerText(card) && card.options.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {card.options.map((o) => (
                        <li key={o.label} className="flex gap-2 text-sm text-neutral-600">
                          <span className="font-semibold text-neutral-400">{o.label}.</span>
                          <span className="min-w-0 flex-1">
                            {o.text && <span className="whitespace-pre-line">{o.text}</span>}
                            <OptionImage image={o.image} alt={o.text || `Option ${o.label}`} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-400 transition group-hover:text-neutral-600">
                    <Restart className="h-4 w-4" /> Tap to reveal the answer
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <FlashAnswer q={card} />
                  {card.explanation && (
                    <div className="mt-3 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      <span className="font-medium text-neutral-700">Why: </span>
                      {card.explanation}
                    </div>
                  )}
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-400 transition group-hover:text-neutral-600">
                    <Restart className="h-4 w-4" /> Tap to see the question
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200 bg-white px-6 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => gotoCard(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
            >
              <ChevronLeft /> Back
            </button>

            {!flipped ? (
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Show answer
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => rateCard(card.id, WRONG)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
                    verdict === WRONG
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  <Restart className="h-4 w-4" /> Still learning
                </button>
                <button
                  type="button"
                  onClick={() => rateCard(card.id, RIGHT)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
                >
                  <Check className="h-4 w-4" /> {isLastCard ? "Got it · finish" : "Got it"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (runMode === "page") {
    const answered = test.filter((q) => answers[q.id] != null).length;
    return (
      <div className={rootCls}>
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
                <StemImage q={q} />
                {usesAnswerText(q) ? (
                  <OpenAnswerPanel
                    answer={q.answerText ?? ""}
                    filled={clozeFill(q)}
                    revealed={!!revealed[q.id]}
                    verdict={answers[q.id]}
                    onReveal={() => reveal(q.id)}
                    onGrade={(v) => {
                      if (answers[q.id] !== v) feedback(v === RIGHT);
                      selfGrade(q.id, v);
                    }}
                  />
                ) : (
                  <div className="mt-4 space-y-2">
                    {isMultiSelect(q) && <SelectAllHint />}
                    {q.options.map((o) => (
                      <OptionButton
                        key={o.label}
                        label={o.label}
                        text={o.text}
                        image={o.image}
                        multi={isMultiSelect(q)}
                        selected={
                          isMultiSelect(q)
                            ? decodeChoice(answers[q.id]).includes(o.label)
                            : answers[q.id] === o.label
                        }
                        onClick={() => choose(q.id, o.label)}
                      />
                    ))}
                  </div>
                )}
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
    <div className={rootCls}>
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
            <StemImage q={q} />
            {usesAnswerText(q) ? (
              <OpenAnswerPanel
                answer={q.answerText ?? ""}
                filled={clozeFill(q)}
                revealed={!!revealed[q.id]}
                verdict={answers[q.id]}
                onReveal={() => reveal(q.id)}
                onGrade={(v) => {
                  if (answers[q.id] !== v) feedback(v === RIGHT);
                  selfGrade(q.id, v);
                }}
                explanation={q.explanation}
              />
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  {isMultiSelect(q) && <SelectAllHint />}
                  {q.options.map((o) => (
                    <OptionButton
                      key={o.label}
                      label={o.label}
                      text={o.text}
                      image={o.image}
                      multi={isMultiSelect(q)}
                      selected={
                        isMultiSelect(q)
                          ? decodeChoice(answers[q.id]).includes(o.label)
                          : answers[q.id] === o.label
                      }
                      onClick={() => choose(q.id, o.label)}
                      revealed={checked[q.id]}
                      isCorrect={
                        isMultiSelect(q)
                          ? (q.correctSet ?? []).includes(o.label)
                          : o.label === q.correct
                      }
                      disabled={checked[q.id]}
                    />
                  ))}
                </div>
                {checked[q.id] && (
                  <FeedbackNote correct={gradeMcq(q, answers[q.id])} explanation={q.explanation} />
                )}
              </>
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
          {!usesAnswerText(q) && !checked[q.id] ? (
            <button
              type="button"
              onClick={() => {
                setChecked((c) => ({ ...c, [q.id]: true }));
                feedback(answers[q.id] === q.correct);
              }}
              disabled={answers[q.id] == null}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Check
            </button>
          ) : isLast ? (
            <button
              type="button"
              onClick={() => setPhase("results")}
              disabled={usesAnswerText(q) && answers[q.id] == null}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
              disabled={usesAnswerText(q) && answers[q.id] == null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
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

/** A subtle reminder under a multi-select stem that more than one answer is
 *  expected. The square checkbox indicators already signal it, but the words
 *  make the all-or-nothing grading expectation explicit. */
function SelectAllHint() {
  return (
    <p className="-mt-1 mb-1 text-xs font-medium text-neutral-500">Select all that apply</p>
  );
}

function OptionButton({
  label,
  text,
  image,
  selected,
  onClick,
  revealed = false,
  isCorrect = false,
  disabled = false,
  multi = false,
}: {
  label: string;
  text: string;
  /** Per-choice picture (image-per-answer questions); rendered beneath the text. */
  image?: QuestionImage | null;
  selected: boolean;
  onClick: () => void;
  revealed?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
  /** Multi-select item: render the indicator as a square checkbox (you can pick
   *  several) rather than a round radio (exactly one). */
  multi?: boolean;
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
          "grid h-6 w-6 shrink-0 place-items-center border-2 text-xs font-semibold transition",
          multi ? "rounded-md" : "rounded-full",
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
          "min-w-0 flex-1",
          showCorrect
            ? "font-medium text-emerald-900"
            : showWrong
              ? "font-medium text-rose-900"
              : selected
                ? "font-medium text-neutral-900"
                : "text-neutral-700",
        )}
      >
        {/* Show the text; if a choice has none (a labeled-diagram option) but no
            picture either, fall back to its letter so the row isn't blank. */}
        {(text || !image) && <span className="whitespace-pre-line">{text || label}</span>}
        <OptionImage image={image} alt={text || `Option ${label}`} />
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

/** Short-answer flow: recall → reveal the reference answer → self-grade. Used in
 *  both formats while running; the reference answer is hidden until "Show
 *  answer" so the recall stays honest. */
function OpenAnswerPanel({
  answer,
  filled = null,
  revealed,
  verdict,
  onReveal,
  onGrade,
  explanation = null,
}: {
  answer: string;
  /** For cloze: the stem with the answer dropped into its blank, so the reveal
   *  shows the completed sentence instead of a detached answer. */
  filled?: FilledBlank | null;
  revealed: boolean;
  verdict: string | undefined;
  onReveal: () => void;
  onGrade: (v: string) => void;
  explanation?: string | null;
}) {
  if (!revealed) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={onReveal}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Show answer
        </button>
        <p className="mt-2 text-xs text-neutral-400">
          Recall the answer, then reveal it and grade yourself.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {filled ? "Completed" : "Answer"}
        </div>
        <div className="mt-1 whitespace-pre-line text-sm text-neutral-900">
          {filled ? <FilledSentence filled={filled} /> : answer}
        </div>
        {explanation && (
          <div className="mt-2 border-t border-neutral-200 pt-2 text-sm text-neutral-600">
            <span className="font-medium text-neutral-700">Why: </span>
            {explanation}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs font-medium text-neutral-500">Did you get it right?</div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onGrade(RIGHT)}
            aria-pressed={verdict === RIGHT}
            className={cx(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
              verdict === RIGHT
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
            )}
          >
            <Check className="h-4 w-4" /> I got it right
          </button>
          <button
            type="button"
            onClick={() => onGrade(WRONG)}
            aria-pressed={verdict === WRONG}
            className={cx(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
              verdict === WRONG
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
            )}
          >
            <Close className="h-4 w-4" /> I missed it
          </button>
        </div>
      </div>
    </div>
  );
}

/** The reference answer shown for a self-graded question on the results screen
 *  (the Correct/Incorrect verdict is the badge above it). For cloze it shows the
 *  completed sentence, with the filled-in word emphasized. */
function OpenAnswerReview({
  answer,
  filled = null,
}: {
  answer: string;
  filled?: FilledBlank | null;
}) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">
        {filled ? "Completed" : "Answer"}
      </div>
      <div className="mt-1 whitespace-pre-line text-sm text-emerald-900">
        {filled ? <FilledSentence filled={filled} /> : answer}
      </div>
    </div>
  );
}

/** A cloze stem rendered with its blank filled, the answer emphasized so the
 *  eye lands on what was recalled: "The powerhouse of the cell is the
 *  __mitochondria__." */
function FilledSentence({ filled }: { filled: FilledBlank }) {
  return (
    <span>
      {filled.before}
      <span className="font-semibold underline decoration-2 underline-offset-2">
        {filled.answer}
      </span>
      {filled.after}
    </span>
  );
}

/** The answer side of a flashcard, for any question type: the correct option for
 *  an MCQ, the completed sentence for a cloze, or the reference answer for a
 *  short-answer. Always rendered in the same emerald "answer" treatment. */
function FlashAnswer({ q }: { q: Question }) {
  if (usesAnswerText(q)) {
    const filled = clozeFill(q);
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">
          {filled ? "Completed" : "Answer"}
        </div>
        <div className="mt-1 whitespace-pre-line text-lg text-emerald-900">
          {filled ? <FilledSentence filled={filled} /> : q.answerText ?? ""}
        </div>
      </div>
    );
  }
  // Multi-select: list every correct option, not just the first.
  if (isMultiSelect(q)) {
    const correctOpts = q.options.filter((o) => (q.correctSet ?? []).includes(o.label));
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">
          Correct answers
        </div>
        <ul className="mt-1 space-y-1 text-lg text-emerald-900">
          {correctOpts.map((o) => (
            <li key={o.label} className="flex items-start gap-2">
              <span className="font-semibold">{o.label}.</span>
              <span className="min-w-0 flex-1">
                {o.text && <span className="whitespace-pre-line">{o.text}</span>}
                <OptionImage image={o.image} alt={o.text || `Option ${o.label}`} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const correctOpt = q.options.find((o) => o.label === q.correct);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">
        Correct answer
      </div>
      <div className="mt-1 flex items-start gap-2 text-lg text-emerald-900">
        {correctOpt && <span className="font-semibold">{correctOpt.label}.</span>}
        <span className="min-w-0 flex-1">
          {(correctOpt?.text || !correctOpt) && (
            <span className="whitespace-pre-line">{correctOpt?.text ?? q.correct}</span>
          )}
          <OptionImage image={correctOpt?.image} alt={correctOpt?.text || "Correct option"} />
        </span>
      </div>
    </div>
  );
}
