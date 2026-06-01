"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Quiz, Question, QuestionOption, QuestionImage, SkippedItem } from "@/lib/domain/types";
import { usesAnswerText, isMultiSelect } from "@/lib/domain/types";
import { useEntitlement } from "@/lib/auth/entitlement-client";
import { useAccount } from "@/lib/auth/account";
import { AccountModal } from "@/components/shell/AccountMenu";
import { scoreQuestion } from "@/lib/importers/pdf/parser/confidence";
import { newQuestionId } from "@/lib/domain/ids";
import { saveQuiz, getQuiz } from "@/lib/storage/quiz-library";
import {
  storeImageFile,
  deleteImage,
  useImage,
  readTray,
  writeTray,
  clearTray,
  type TrayImage,
} from "@/lib/storage/image-store";
import { QuizPlayer } from "@/components/quiz-player/QuizPlayer";
import {
  Alert,
  Blank,
  Check,
  ChevronDown,
  ChevronLeft,
  Close,
  Dots,
  Folder,
  Grid,
  ImageIcon,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash,
  Upload,
} from "./icons";

const LETTERS = "ABCDEFGHIJ".split("");

/** Mirrors the server cap in /api/ai/solve — we never send more than this in one
 *  call. With more keyless questions the panel solves a batch, then offers the
 *  rest on the next click. */
const MAX_AI_QUESTIONS = 40;

/** A question has a usable answer when an option is marked correct (MCQ) or the
 *  reference text is filled (self-graded). Single source of truth for the
 *  "no answer key" banner AND the set of questions the AI solver is offered. */
function questionHasAnswer(q: Question): boolean {
  return usesAnswerText(q) ? !!q.answerText?.trim() : q.correct != null;
}

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** Human label for a question's type, shown on the sidebar row and card badge. */
function questionTypeLabel(type: Question["type"]): string {
  switch (type) {
    case "open":
      return "Short answer";
    case "cloze":
      return "Fill in the blank";
    case "true_false":
      return "True / False";
    default:
      return "Multiple choice";
  }
}

/** Recompute confidence + flags purely from current structure (clean base, so
 * structural flags never accumulate). Fixing a question clears its flags live. */
function rescore(q: Question): Question {
  const base = { ...q, flags: [] as string[] };
  const { confidence, flags } = scoreQuestion(base);
  return { ...q, confidence, flags };
}

function relabel(options: QuestionOption[]): QuestionOption[] {
  return options.map((o, i) => ({ ...o, label: LETTERS[i] ?? o.label }));
}

/** Stable string view of the editable surface (title + questions) used to tell
 *  whether the user has actually changed anything since the editor opened. */
function serialize(q: Quiz): string {
  return JSON.stringify({ title: q.title, questions: q.questions });
}

/** A skipped block plus a stable uid for list keys / removal. */
interface SkippedRow extends SkippedItem {
  uid: string;
}

/* ------------------------------------------------------------------ *
 * Sidebar entry — memoized so a keystroke in one card only re-renders
 * that question's row (its stem preview), not every row in the list.
 * ------------------------------------------------------------------ */
interface SidebarItemProps {
  q: Question;
  index: number;
  active: boolean;
  onSelect: (id: string) => void;
}

const SidebarItem = memo(function SidebarItem({ q, index, active, onSelect }: SidebarItemProps) {
  const flagged = q.flags.length > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(q.id)}
      className={cx(
        "w-full rounded-xl border p-3 text-left transition",
        active
          ? "border-neutral-900 shadow-sm ring-1 ring-neutral-900"
          : "border-neutral-200 hover:border-neutral-300",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cx(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold",
            active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600",
          )}
        >
          {index + 1}
        </span>
        <span
          className={cx(
            "truncate text-sm font-medium",
            q.stem.trim() ? "text-neutral-800" : "text-neutral-400",
          )}
        >
          {q.stem.trim() || "Untitled question"}
        </span>
        {flagged && <Alert className="ml-auto h-4 w-4 shrink-0 text-amber-500" />}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-neutral-400">
        {q.type === "open" ? (
          <Pencil className="h-3.5 w-3.5" />
        ) : q.type === "cloze" ? (
          <Blank className="h-3.5 w-3.5" />
        ) : q.type === "true_false" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Grid className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">{questionTypeLabel(q.type)}</span>
      </div>
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * Per-question image control. The bytes live in IndexedDB (image-store);
 * this only reads/writes the lightweight reference on the question and
 * cleans up the bytes it replaces or removes. The preview loads lazily via
 * `useImage`, so a freshly attached image appears as soon as it's stored.
 * ------------------------------------------------------------------ */
function ImageField({
  q,
  onChange,
}: {
  q: Question;
  onChange: (image: QuestionImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = useImage(q.image?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const prevId = q.image?.id;
    try {
      const ref = await storeImageFile(file);
      onChange(ref);
      if (prevId) deleteImage(prevId).catch(() => {}); // drop the replaced bytes
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
    }
  }

  function remove() {
    const prevId = q.image?.id;
    setError(null);
    onChange(null);
    if (prevId) deleteImage(prevId).catch(() => {});
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {q.image ? (
        <div>
          {url ? (
            /* eslint-disable-next-line @next/next/no-img-element -- dataURL from IndexedDB */
            <img
              src={url}
              alt={q.image.alt?.trim() || "Question image"}
              className="max-h-60 w-auto rounded-xl border border-neutral-200 object-contain"
            />
          ) : (
            <div className="grid h-28 w-44 place-items-center rounded-xl border border-dashed border-neutral-200 text-neutral-300">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {busy ? "Replacing…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
            >
              <Trash className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" />
          {busy ? "Adding…" : "Add image"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Review-tray thumbnail — one auto-extracted figure offered for attaching.
 * Its bytes already live in IndexedDB (the uploader wrote them); we only load
 * the preview by id and expose "attach to the active question" / "dismiss".
 * ------------------------------------------------------------------ */
function TrayThumb({
  t,
  attachLabel,
  canAttach,
  onAttach,
  onDismiss,
}: {
  t: TrayImage;
  attachLabel: string;
  canAttach: boolean;
  onAttach: () => void;
  onDismiss: () => void;
}) {
  const url = useImage(t.id);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="relative grid aspect-[4/3] place-items-center bg-neutral-50">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element -- dataURL from IndexedDB */
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="h-5 w-5 text-neutral-300" />
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss image"
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/80 text-neutral-500 backdrop-blur transition hover:bg-white hover:text-neutral-800"
        >
          <Close className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="min-w-0 truncate text-[11px] text-neutral-400" title={t.sourceLabel}>
          Page {t.page}
          {t.sourceLabel ? ` · ${t.sourceLabel}` : ""}
        </span>
        <button
          type="button"
          onClick={onAttach}
          disabled={!canAttach}
          className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-neutral-700 disabled:cursor-default disabled:opacity-40"
        >
          {attachLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Question editor card — memoized. Receives only its own question plus
 * stable callbacks, so editing one card (a new `q` reference) leaves the
 * other cards' props untouched and React.memo skips re-rendering them.
 * ------------------------------------------------------------------ */
interface QuestionCardProps {
  q: Question;
  index: number;
  active: boolean;
  menuOpen: boolean;
  canDelete: boolean;
  /** The AI solver's reasoning for this question, held transiently in the editor
   *  (never persisted on the quiz) so "Why this answer?" can expand without a
   *  second call. Present only right after an AI solve. */
  aiReasoning?: string;
  registerRef: (id: string, el: HTMLElement | null) => void;
  setActiveId: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  deleteQuestion: (id: string) => void;
  setStem: (id: string, stem: string) => void;
  setImage: (id: string, image: QuestionImage | null) => void;
  setAnswerText: (id: string, text: string) => void;
  setExplanation: (id: string, explanation: string) => void;
  setOptionText: (id: string, label: string, text: string) => void;
  setCorrect: (id: string, label: string) => void;
  addOption: (id: string) => void;
  deleteOption: (id: string, label: string) => void;
}

const QuestionCard = memo(function QuestionCard({
  q,
  index,
  active,
  menuOpen,
  canDelete,
  aiReasoning,
  registerRef,
  setActiveId,
  onToggleMenu,
  onCloseMenu,
  deleteQuestion,
  setStem,
  setImage,
  setAnswerText,
  setExplanation,
  setOptionText,
  setCorrect,
  addOption,
  deleteOption,
}: QuestionCardProps) {
  const flagged = q.flags.length > 0;
  const [showReason, setShowReason] = useState(false);
  return (
    <section
      ref={(el) => {
        registerRef(q.id, el);
      }}
      onMouseDown={() => setActiveId(q.id)}
      className={cx(
        "relative rounded-2xl border bg-white p-6 shadow-sm transition",
        active ? "border-neutral-300 shadow-md" : "border-neutral-200",
      )}
    >
      {/* card header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm font-medium text-neutral-700">
          <span className="grid h-5 w-5 place-items-center rounded bg-neutral-900 text-white">
            {q.type === "open" ? (
              <Pencil className="h-3 w-3" />
            ) : q.type === "cloze" ? (
              <Blank className="h-3 w-3" />
            ) : q.type === "true_false" ? (
              <Check className="h-3 w-3" />
            ) : (
              <Grid className="h-3 w-3" />
            )}
          </span>
          {questionTypeLabel(q.type)}
        </span>

        <div className="flex items-center gap-2">
          {flagged ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <Alert className="h-3.5 w-3.5" />
              Needs review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
              <Check className="h-3 w-3" />
              {Math.round(q.confidence * 100)}% confident
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => onToggleMenu(q.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100"
              aria-label="Question options"
            >
              <Dots />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => onCloseMenu()} />
                <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    disabled={!canDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <Trash className="h-4 w-4" />
                    Delete question
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* question label + stem */}
      <div className="mt-5 text-sm font-semibold text-neutral-800">Question {index + 1}</div>

      <textarea
        rows={1}
        value={q.stem}
        placeholder="Write the question…"
        onChange={(e) => setStem(q.id, e.target.value)}
        onInput={(e) => {
          const t = e.currentTarget;
          t.style.height = "auto";
          t.style.height = `${t.scrollHeight}px`;
        }}
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
        className="mt-3 block min-h-[60px] w-full resize-none rounded-xl bg-neutral-50 p-4 text-[15px] leading-relaxed text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900/10"
      />

      <ImageField q={q} onChange={(image) => setImage(q.id, image)} />

      {usesAnswerText(q) ? (
        /* self-graded (short-answer / fill-in-the-blank): one reference answer,
           revealed for self-grading */
        <>
          <div className="mt-5 text-sm font-medium text-neutral-700">Answer</div>
          <textarea
            rows={2}
            value={q.answerText ?? ""}
            placeholder="The expected answer — revealed when self-grading…"
            onChange={(e) => setAnswerText(q.id, e.target.value)}
            className="mt-2 block w-full resize-none rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900/10"
          />
        </>
      ) : (
        <>
          {/* choices */}
          <div className="mt-5 flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">Choices</span>
            {isMultiSelect(q) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                Select all that apply
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => {
              const multi = isMultiSelect(q);
              const correct = multi
                ? (q.correctSet ?? []).includes(o.label)
                : q.correct === o.label;
              return (
                <div key={o.label} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCorrect(q.id, o.label)}
                    aria-pressed={correct}
                    aria-label={`Mark option ${o.label} correct`}
                    className={cx(
                      "grid h-6 w-6 shrink-0 place-items-center border-2 transition",
                      multi ? "rounded-md" : "rounded-full",
                      correct
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 text-transparent hover:border-neutral-400",
                    )}
                  >
                    <Check />
                  </button>
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-neutral-400">
                    {o.label}
                  </span>
                  <input
                    value={o.text}
                    placeholder={`Option ${o.label}`}
                    onChange={(e) => setOptionText(q.id, o.label, e.target.value)}
                    className={cx(
                      "flex-1 rounded-lg px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-neutral-900/10",
                      correct ? "bg-neutral-900/5 font-medium" : "bg-neutral-50",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => deleteOption(q.id, o.label)}
                    disabled={q.options.length <= 2}
                    className="grid h-8 w-8 place-items-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white"
                    aria-label={`Delete option ${o.label}`}
                  >
                    <Trash />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => addOption(q.id)}
            disabled={q.options.length >= LETTERS.length || q.type === "true_false"}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-default disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add option
          </button>
        </>
      )}

      {/* AI-suggested answer — clearly marked as an inference, never an official
          key. Editing the answer above clears this (setCorrect/setAnswerText
          reset the origin), so a user-confirmed answer drops the label. */}
      {q.answerOrigin === "ai" && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
            <span className="text-xs font-medium text-violet-900">
              AI-suggested answer — not from an official key
            </span>
            {typeof q.answerConfidence === "number" && (
              <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                {Math.round(q.answerConfidence * 100)}% confident
              </span>
            )}
          </div>
          {aiReasoning && (
            <>
              <button
                type="button"
                onClick={() => setShowReason((s) => !s)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 transition hover:text-violet-900"
              >
                <ChevronDown
                  className={cx("h-3.5 w-3.5 transition", showReason ? "rotate-180" : "")}
                />
                {showReason ? "Hide reasoning" : "Why this answer?"}
              </button>
              {showReason && (
                <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-violet-800">
                  {aiReasoning}
                </p>
              )}
            </>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-violet-700/80">
            Check it and edit above if it&rsquo;s wrong — your change replaces the suggestion.
          </p>
        </div>
      )}

      {flagged && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <Alert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Needs review — {q.flags.join("; ")}.
            {usesAnswerText(q)
              ? " Fill in the answer to clear this."
              : " Pick the correct answer to clear this."}
          </span>
        </div>
      )}

      {/* explanation */}
      <div className="mt-5 text-sm font-medium text-neutral-700">
        Explanation <span className="font-normal text-neutral-400">(optional)</span>
      </div>
      <textarea
        rows={2}
        value={q.explanation ?? ""}
        placeholder="Why is this the correct answer?"
        onChange={(e) => setExplanation(q.id, e.target.value)}
        className="mt-2 block w-full resize-none rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700 outline-none transition focus:ring-2 focus:ring-neutral-900/10"
      />
    </section>
  );
});

export function QuizEditor({ initial }: { initial: Quiz }) {
  const [quiz, setQuiz] = useState<Quiz>(() => ({
    ...initial,
    questions: initial.questions.map(rescore),
    skipped: undefined, // held separately below; never part of the saved quiz
  }));
  // Snapshot of the editor's starting state, captured once. Publish compares
  // against it so an untouched, already-published quiz skips the naming dialog
  // and goes straight to My quizzes. Guarded so rescore runs a single time.
  const pristineRef = useRef<string | null>(null);
  if (pristineRef.current === null) {
    pristineRef.current = serialize({
      ...initial,
      questions: initial.questions.map(rescore),
    });
  }
  // Blocks the parser couldn't auto-import. Kept outside `quiz` so they never
  // publish; each is the user's to promote into a real question or dismiss.
  const [skipped, setSkipped] = useState<SkippedRow[]>(() =>
    (initial.skipped ?? []).map((s, i) => ({ ...s, uid: `sk-${i}` })),
  );
  const [activeId, setActiveId] = useState<string>(initial.questions[0]?.id ?? "");
  const [menuId, setMenuId] = useState<string | null>(null);
  // Figures auto-extracted from the imported PDF, offered for attaching. Loaded
  // AFTER mount (sessionStorage is client-only) so SSR and first client render
  // agree on an empty tray and there's no hydration mismatch.
  const [tray, setTray] = useState<TrayImage[]>([]);
  const [trayOpen, setTrayOpen] = useState(true);
  useEffect(() => {
    setTray(readTray(initial.id));
  }, [initial.id]);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  // Mirror of the latest quiz so stable callbacks (deleteQuestion) can read
  // current questions without taking `quiz` as a dependency (which would make
  // them change identity every render and defeat the card memoization).
  const quizRef = useRef(quiz);
  quizRef.current = quiz;

  const router = useRouter();
  const [previewing, setPreviewing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Publishing requires *some* identity — a Google account or the local device
  // profile. Either is fine; this only stops fully-anonymous publishing. When a
  // publish is attempted without one, we open the sign-in modal and resume the
  // publish (via the effect below) once an identity exists.
  const { data: session } = useSession();
  const account = useAccount();
  const hasIdentity = Boolean(session?.user) || Boolean(account);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(false);
  // Pending in-app navigation held back by the unsaved-changes guard. Non-null
  // means "the user tried to leave to this path but has unsaved edits" → the
  // confirm dialog is showing.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  // ---- AI answer-solving (paid layer) -----------------------------------
  // Viewer's Pro status (display-only; the /api/ai/solve route is the real gate)
  // and whether the AI layer is configured at all (an ANTHROPIC_API_KEY is set).
  // When unconfigured the action is hidden entirely — graceful degradation.
  const { pro, loading: entLoading } = useEntitlement();
  const [aiConfigured, setAiConfigured] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  // The solver's per-question reasoning, kept transiently (NOT persisted on the
  // quiz) so "Why this answer?" can expand without another call. Keyed by qid.
  const [aiReasoning, setAiReasoning] = useState<Record<string, string>>({});

  // Whether the editable surface differs from the snapshot taken on open (or on
  // the last save). Drives both the in-app leave guard and the browser one.
  const isDirty = useCallback(
    () => serialize(quizRef.current) !== pristineRef.current,
    [],
  );

  // Hard-navigation guard: reload, tab close, or following an external link with
  // unsaved edits trips the browser's native "Leave site?" prompt. Client-side
  // navigations (Save & leave, Publish) don't fire this, so they pass freely.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = ""; // Chrome requires a set returnValue to show the prompt
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Ask the server whether the AI layer is switched on. Cheap, exposes no
  // secret; mirrors how /api/plans gates the upgrade UI. Failure → stays off.
  useEffect(() => {
    let active = true;
    fetch("/api/ai/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d: { configured?: boolean }) => {
        if (active) setAiConfigured(Boolean(d.configured));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // ---- Stable handlers (useCallback) ------------------------------------
  // Each is referentially stable across renders so the memoized cards/rows
  // they're passed to don't re-render on unrelated state changes.
  const patchQuestion = useCallback((id: string, fn: (q: Question) => Question) => {
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? rescore(fn(q)) : q)),
    }));
  }, []);

  const setStem = useCallback(
    (id: string, stem: string) => patchQuestion(id, (q) => ({ ...q, stem })),
    [patchQuestion],
  );

  // Record (or clear) a question's image reference. The bytes are written to /
  // removed from IndexedDB by the ImageField itself; here we only persist the
  // pointer on the quiz.
  const setImage = useCallback(
    (id: string, image: QuestionImage | null) =>
      patchQuestion(id, (q) => ({ ...q, image })),
    [patchQuestion],
  );

  // Editing the reference answer makes it a user-owned answer: clear any AI/
  // mark-scheme provenance (and the AI confidence) so the "AI-suggested" label
  // drops the moment the user touches it.
  const setAnswerText = useCallback(
    (id: string, text: string) =>
      patchQuestion(id, (q) => ({
        ...q,
        answerText: text === "" ? null : text,
        answerOrigin: text.trim() === "" ? null : "detected",
        answerConfidence: null,
      })),
    [patchQuestion],
  );

  const setExplanation = useCallback(
    (id: string, explanation: string) =>
      patchQuestion(id, (q) => ({ ...q, explanation: explanation === "" ? null : explanation })),
    [patchQuestion],
  );

  const setOptionText = useCallback(
    (id: string, label: string, text: string) =>
      patchQuestion(id, (q) => ({
        ...q,
        options: q.options.map((o) => (o.label === label ? { ...o, text } : o)),
      })),
    [patchQuestion],
  );

  const setCorrect = useCallback(
    (id: string, label: string) =>
      patchQuestion(id, (q) => {
        // Multi-select: toggle this label in/out of the correct set, keeping the
        // set in option order. If it falls below two answers, collapse back to a
        // single-answer question so every single-answer path stays valid.
        if (isMultiSelect(q)) {
          const cur = new Set(q.correctSet ?? []);
          if (cur.has(label)) cur.delete(label);
          else cur.add(label);
          const nextSet = q.options.map((o) => o.label).filter((l) => cur.has(l));
          if (nextSet.length >= 2) {
            return {
              ...q,
              correct: nextSet[0],
              correctSet: nextSet,
              answerOrigin: "detected",
              answerConfidence: null,
            };
          }
          return {
            ...q,
            correct: nextSet[0] ?? null,
            correctSet: null,
            answerOrigin: nextSet.length ? "detected" : null,
            answerConfidence: null,
          };
        }
        const correct = q.correct === label ? null : label;
        return {
          ...q,
          correct,
          // Picking/overriding an option makes it user-owned → drop the AI label.
          answerOrigin: correct == null ? null : "detected",
          answerConfidence: null,
        };
      }),
    [patchQuestion],
  );

  const addOption = useCallback(
    (id: string) =>
      patchQuestion(id, (q) => ({
        ...q,
        options: relabel([...q.options, { label: LETTERS[q.options.length] ?? "?", text: "" }]),
      })),
    [patchQuestion],
  );

  const deleteOption = useCallback(
    (id: string, label: string) =>
      patchQuestion(id, (q) => {
        const idx = q.options.findIndex((o) => o.label === label);
        if (idx === -1) return q;
        const kept = q.options.filter((_, i) => i !== idx);
        const remaining = relabel(kept);
        // Old label → new label: relabel reassigns A,B,C… by position, so every
        // option after the deleted one shifts up a letter. Carry answers across
        // this map instead of by raw label (which would go stale).
        const remap = new Map<string, string>();
        kept.forEach((o, i) => remap.set(o.label, remaining[i].label));
        // Multi-select: drop the deleted label, remap the rest, and collapse to a
        // single-answer question if fewer than two correct answers survive.
        if (isMultiSelect(q)) {
          const nextSet = (q.correctSet ?? [])
            .filter((l) => l !== label)
            .map((l) => remap.get(l))
            .filter(Boolean) as string[];
          if (nextSet.length >= 2) {
            return { ...q, options: remaining, correct: nextSet[0], correctSet: nextSet };
          }
          return { ...q, options: remaining, correct: nextSet[0] ?? null, correctSet: null };
        }
        // Single answer: keep it unless the deleted option WAS the answer.
        const correct =
          q.correct && q.correct !== label ? remap.get(q.correct) ?? null : null;
        return { ...q, options: remaining, correct };
      }),
    [patchQuestion],
  );

  const selectQuestion = useCallback((id: string) => {
    setActiveId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    cardRefs.current[id] = el;
  }, []);

  const toggleMenu = useCallback((id: string) => setMenuId((m) => (m === id ? null : id)), []);
  const closeMenu = useCallback(() => setMenuId(null), []);

  const deleteQuestion = useCallback((id: string) => {
    const qs = quizRef.current.questions;
    const idx = qs.findIndex((q) => q.id === id);
    const imageId = qs[idx]?.image?.id;
    const remaining = qs.filter((q) => q.id !== id);
    setQuiz((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
    if (imageId) deleteImage(imageId).catch(() => {}); // don't orphan its bytes
    setMenuId(null);
    setActiveId((cur) =>
      cur === id ? (remaining[idx] ?? remaining[idx - 1])?.id ?? "" : cur,
    );
  }, []);

  // ---- AI answer-solving -------------------------------------------------
  // Send the paper's KEYLESS questions (only those, never ones that already have
  // an answer) to /api/ai/solve and fill in what comes back, tagged answerOrigin
  // "ai" + the model's self-reported confidence. The route enforces the real
  // gate (Pro, caps, metering); this handler just collects, posts, and applies.
  const solveWithAI = useCallback(async () => {
    const keyless = quizRef.current.questions.filter((q) => !questionHasAnswer(q));
    const batch = keyless.slice(0, MAX_AI_QUESTIONS); // respect the server cap
    if (batch.length === 0) return;

    setSolving(true);
    setSolveError(null);
    try {
      const payload = batch.map((q) => ({
        id: q.id,
        type: q.type,
        stem: q.stem,
        options: q.options.map((o) => ({ label: o.label, text: o.text })),
      }));
      const res = await fetch("/api/ai/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questions: payload }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const fallback =
          res.status === 401
            ? "Sign in to use AI solving."
            : res.status === 403
              ? "AI answer-solving is a Pro feature."
              : res.status === 429
                ? "You’ve hit this hour’s AI limit — please try again shortly."
                : res.status === 503
                  ? "AI answer-solving isn’t set up yet."
                  : "The AI couldn’t solve these right now. Please try again.";
        setSolveError(data.error || fallback);
        return;
      }

      const data = (await res.json()) as {
        results?: { id: string; answer: string; confidence: number; reasoning: string }[];
      };
      const results = data.results ?? [];
      if (results.length === 0) {
        setSolveError("The AI didn’t return any answers. Please try again.");
        return;
      }

      const byId = new Map(results.map((r) => [r.id, r]));
      const reasoningUpdates: Record<string, string> = {};
      setQuiz((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => {
          const r = byId.get(q.id);
          if (!r || !r.answer) return q;
          if (r.reasoning) reasoningUpdates[q.id] = r.reasoning;
          const filled = usesAnswerText(q)
            ? { ...q, answerText: r.answer }
            : { ...q, correct: r.answer };
          return rescore({
            ...filled,
            answerOrigin: "ai" as const,
            answerConfidence: r.confidence,
          });
        }),
      }));
      if (Object.keys(reasoningUpdates).length > 0) {
        setAiReasoning((prev) => ({ ...prev, ...reasoningUpdates }));
      }
    } catch {
      setSolveError("Couldn’t reach the AI just now. Please try again.");
    } finally {
      setSolving(false);
    }
  }, []);

  // ---- Review-tray actions ----------------------------------------------
  // Attach a tray figure to the ACTIVE question. Its bytes already live in
  // IndexedDB under the same id, so we only point the question at them; any
  // image that question previously carried is now orphaned and dropped.
  function attachToActive(t: TrayImage) {
    const target = quizRef.current.questions.find((q) => q.id === activeId);
    if (!target) return;
    const prevImageId = target.image?.id;
    setImage(target.id, { id: t.id, alt: "", width: t.width, height: t.height });
    if (prevImageId && prevImageId !== t.id) deleteImage(prevImageId).catch(() => {});
    setTray((prev) => {
      const remaining = prev.filter((x) => x.id !== t.id);
      writeTray(quizRef.current.id, remaining);
      return remaining;
    });
  }

  // Discard a figure the user doesn't want — reclaim its never-attached bytes.
  function dismissTrayImage(id: string) {
    deleteImage(id).catch(() => {});
    setTray((prev) => {
      const remaining = prev.filter((x) => x.id !== id);
      writeTray(quizRef.current.id, remaining);
      return remaining;
    });
  }

  function addQuestion() {
    const q = rescore({
      id: newQuestionId(),
      number: quiz.questions.length + 1,
      type: "mcq",
      stem: "",
      options: [
        { label: "A", text: "" },
        { label: "B", text: "" },
      ],
      correct: null,
      explanation: null,
      confidence: 1,
      flags: [],
    });
    setQuiz((prev) => ({ ...prev, questions: [...prev.questions, q] }));
    setActiveId(q.id);
    setTimeout(
      () => cardRefs.current[q.id]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  }

  /** Turn a skipped block into a real, editable question and append it. A
   *  multi-part part (or any option-less block) is a short-answer prompt, so it
   *  promotes to an editable `open` question — carrying its part/marks so a mark
   *  scheme can still match it — rather than a padded empty-option MCQ shell.
   *  Anything with real options pads to >=2 and re-letters as an MCQ. */
  function promoteSkipped(uid: string) {
    const item = skipped.find((s) => s.uid === uid);
    if (!item) return;
    const asOpen = item.part != null || item.options.length === 0;
    const padded = [...item.options];
    while (padded.length < 2) padded.push({ label: "?", text: "" });
    const q = rescore({
      id: newQuestionId(),
      number: quiz.questions.length + 1,
      stem: item.stem,
      explanation: null,
      confidence: 1,
      flags: [],
      ...(item.part != null ? { part: item.part } : {}),
      ...(item.marks != null ? { marks: item.marks } : {}),
      ...(asOpen
        ? { type: "open" as const, options: [], correct: null, answerText: "" }
        : { type: "mcq" as const, options: relabel(padded), correct: null }),
    });
    setQuiz((prev) => ({ ...prev, questions: [...prev.questions, q] }));
    setSkipped((prev) => prev.filter((s) => s.uid !== uid));
    setActiveId(q.id);
    setTimeout(
      () => cardRefs.current[q.id]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  }

  const dismissSkipped = (uid: string) =>
    setSkipped((prev) => prev.filter((s) => s.uid !== uid));

  // ---- Leaving the editor ------------------------------------------------
  // Every in-app exit (Back, My quizzes) routes through here. With unsaved
  // edits we hold the destination and pop the confirm dialog; otherwise we go.
  function requestLeave(dest: string) {
    if (isDirty()) setLeaveTo(dest);
    else router.push(dest);
  }

  // "Save & leave" — persist with the current title (no rename prompt; the user
  // already named it on import) and clean up the tray exactly as Publish does,
  // then continue to the held destination.
  function saveAndLeave() {
    const dest = leaveTo ?? "/library";
    const next: Quiz = { ...quiz, title: quiz.title.trim() || "Untitled quiz" };
    setQuiz(next);
    saveQuiz(next);
    tray.forEach((t) => deleteImage(t.id).catch(() => {}));
    clearTray();
    pristineRef.current = serialize(next); // snapshot is now the saved state
    setLeaveTo(null);
    router.push(dest);
  }

  // "Leave without saving" — drop the edits and go. Mark the snapshot clean so a
  // following hard navigation doesn't double-prompt via beforeunload.
  function discardAndLeave() {
    const dest = leaveTo ?? "/library";
    pristineRef.current = serialize(quiz);
    setLeaveTo(null);
    router.push(dest);
  }

  function openPublish() {
    // Nothing edited and the quiz already lives in the library → there's
    // nothing to (re)name or save, so go straight to My quizzes.
    if (serialize(quiz) === pristineRef.current && getQuiz(quiz.id)) {
      router.push("/library");
      return;
    }
    // Gate: you must have an account (Google or local profile) to publish.
    if (!hasIdentity) {
      setPendingPublish(true);
      setSignInOpen(true);
      return;
    }
    setPublishName(quiz.title.trim() || "Untitled quiz");
    setPublishOpen(true);
  }

  // Resume an interrupted publish: once the sign-in modal closes, continue to
  // the name dialog if an identity now exists (otherwise the user cancelled).
  useEffect(() => {
    if (signInOpen || !pendingPublish) return;
    setPendingPublish(false);
    if (hasIdentity) {
      setPublishName(quizRef.current.title.trim() || "Untitled quiz");
      setPublishOpen(true);
    }
  }, [signInOpen, pendingPublish, hasIdentity]);

  function confirmPublish() {
    const name = publishName.trim();
    if (!name) return;
    // Belt-and-suspenders: the open gate should prevent this, but never let an
    // anonymous publish through.
    if (!hasIdentity) {
      setPublishOpen(false);
      setPendingPublish(true);
      setSignInOpen(true);
      return;
    }
    setPublishing(true);
    const next: Quiz = { ...quiz, title: name };
    setQuiz(next);
    saveQuiz(next);
    // Discard any figures left unattached (their bytes would otherwise be
    // orphaned in IndexedDB), then forget the tray for this import.
    tray.forEach((t) => deleteImage(t.id).catch(() => {}));
    clearTray();
    pristineRef.current = serialize(next); // saved → guard won't prompt on the way out
    router.push("/library");
  }

  const needsReview = quiz.questions.filter((q) => q.flags.length > 0).length;
  // The source PDF carried no detectable answer key when nothing is marked
  // correct. Surfaced as a banner so a question-only bank doesn't silently
  // become an ungradeable quiz; it clears the moment any answer is set.
  const hasAnswer = questionHasAnswer;
  const keylessCount = quiz.questions.filter((q) => !hasAnswer(q)).length;
  const noAnswerKey = quiz.questions.length > 0 && keylessCount === quiz.questions.length;
  const canDelete = quiz.questions.length > 1;
  // Which question a tray "Attach" lands on — labelled so the target is obvious.
  const activeIndex = quiz.questions.findIndex((q) => q.id === activeId);
  const attachLabel = activeIndex >= 0 ? `Attach to Q${activeIndex + 1}` : "Attach";

  // Panel shown whenever the paper has unanswered (keyless) questions. It carries
  // the deterministic guidance (set answers by hand) AND — only when the AI layer
  // is configured — the paid "Solve with AI" action: an upsell to /upgrade for
  // non-Pro viewers, the live solver for Pro. Hidden entirely when unconfigured.
  function renderAiCta() {
    if (keylessCount === 0) return null;
    const all = noAnswerKey;
    const solvable = Math.min(keylessCount, MAX_AI_QUESTIONS);
    return (
      <div
        className={cx(
          "rounded-2xl border px-4 py-3.5 text-sm",
          all ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white shadow-sm",
        )}
      >
        <div className="flex items-start gap-3">
          <Alert
            className={cx("mt-0.5 h-4 w-4 shrink-0", all ? "text-amber-600" : "text-neutral-400")}
          />
          <div className="min-w-0 flex-1">
            <p className={cx("font-medium", all ? "text-amber-900" : "text-neutral-800")}>
              {all
                ? "No answer key found in this PDF"
                : `${keylessCount} ${keylessCount === 1 ? "question has" : "questions have"} no answer yet`}
            </p>
            <p className={cx("mt-0.5", all ? "text-amber-700" : "text-neutral-500")}>
              {all
                ? "This looks like a question-only bank — we couldn’t detect any marked correct answers. Set each answer by hand, or let AI suggest a key."
                : "Set the remaining answers by hand, or let AI suggest them."}
            </p>

            {aiConfigured && !entLoading && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                {pro ? (
                  <button
                    type="button"
                    onClick={solveWithAI}
                    disabled={solving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-default disabled:opacity-50"
                  >
                    {solving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {solving ? "Solving…" : `Solve ${solvable} with AI`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/upgrade")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    Solve with AI
                    <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Pro
                    </span>
                  </button>
                )}
                <span className="text-xs text-neutral-400">
                  {pro
                    ? "AI answers are inferences, not an official key."
                    : "Pro suggests a key for papers that ship without one."}
                </span>
              </div>
            )}

            {solveError && <p className="mt-2 text-xs font-medium text-rose-600">{solveError}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
      {/* ---- Top bar ---- */}
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          {/* Wordmark — the same brand/home affordance the global toolbar carries,
              so navigation reads consistently even though this immersive editor
              keeps its own bar (it can't sit under the shell without the shell's
              raw <Link>s bypassing the unsaved-changes guard). Routed through
              requestLeave so edits are never dropped silently. */}
          <button
            type="button"
            onClick={() => requestLeave("/")}
            aria-label="unethicaltools — home"
            className="shrink-0 rounded-lg px-1.5 py-1 text-sm font-semibold tracking-tight text-neutral-900 outline-none transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            unethical<span className="text-neutral-400">tools</span>
          </button>
          <span className="h-5 w-px shrink-0 bg-neutral-200" aria-hidden="true" />
          <button
            type="button"
            onClick={() => requestLeave("/tools/pdf-to-quiz")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
            aria-label="Back"
          >
            <ChevronLeft />
          </button>
          <span className="hidden truncate text-sm text-neutral-400 md:inline">
            {quiz.source.filename ? `Imported from ${quiz.source.filename}` : "Review & edit"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <input
            value={quiz.title}
            onChange={(e) => setQuiz((p) => ({ ...p, title: e.target.value }))}
            className="max-w-[420px] truncate rounded-md bg-transparent px-1 py-0.5 text-center text-sm font-medium text-neutral-900 outline-none hover:bg-neutral-50 focus:bg-neutral-50"
            style={{
              width: `${Math.min(420, Math.max(140, quiz.title.length * 8 + 28))}px`,
            }}
            aria-label="Quiz title"
          />
          <Pencil className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => requestLeave("/library")}
            className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 sm:flex"
          >
            <Folder />
            My quizzes
          </button>
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Play />
            Preview
          </button>
          <button
            type="button"
            onClick={openPublish}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Upload />
            Publish
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- Sidebar ---- */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Questions ({quiz.questions.length})
              </span>
              {needsReview > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Alert className="h-3 w-3" />
                  {needsReview} to review
                </span>
              )}
              {skipped.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                  {skipped.length} skipped
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="grid h-6 w-6 place-items-center rounded-md text-neutral-500 transition hover:bg-neutral-100"
              aria-label="Add question"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {quiz.questions.map((q, i) => (
              <SidebarItem
                key={q.id}
                q={q}
                index={i}
                active={q.id === activeId}
                onSelect={selectQuestion}
              />
            ))}
          </div>
        </aside>

        {/* ---- Editor column ---- */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
            {renderAiCta()}

            {tray.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setTrayOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                  aria-expanded={trayOpen}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
                      <ImageIcon className="h-3.5 w-3.5" />
                    </span>
                    {tray.length} {tray.length === 1 ? "image" : "images"} found in your PDF
                  </span>
                  <ChevronDown
                    className={cx(
                      "h-4 w-4 shrink-0 text-neutral-400 transition",
                      trayOpen ? "rotate-180" : "",
                    )}
                  />
                </button>
                {trayOpen && (
                  <>
                    <p className="mt-1 pl-8 text-xs leading-relaxed text-neutral-500">
                      Pulled straight from your file — we can&rsquo;t tell which question each
                      belongs to. Select a question on the left, attach the figure it belongs to,
                      and dismiss the rest.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {tray.map((t) => (
                        <TrayThumb
                          key={t.id}
                          t={t}
                          attachLabel={attachLabel}
                          canAttach={activeIndex >= 0}
                          onAttach={() => attachToActive(t)}
                          onDismiss={() => dismissTrayImage(t.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {skipped.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
                    <Alert className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-medium text-neutral-800">
                    {skipped.length} {skipped.length === 1 ? "block" : "blocks"} couldn&rsquo;t be
                    imported automatically
                  </p>
                </div>
                <p className="mt-1 pl-8 text-xs leading-relaxed text-neutral-500">
                  We found this text but it didn&rsquo;t look like a clean multiple-choice question.
                  Add it as a question to edit it yourself, or dismiss it.
                </p>

                <div className="mt-3 space-y-2">
                  {skipped.map((s) => (
                    <div key={s.uid} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                          {s.reason}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => promoteSkipped(s.uid)}
                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add as question
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissSkipped(s.uid)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-600"
                            aria-label="Dismiss"
                          >
                            <Close className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {(s.stem || s.options.length > 0) && (
                        <div className="mt-2 space-y-1 text-xs text-neutral-600">
                          {s.stem && (
                            <p className="line-clamp-3 whitespace-pre-line">
                              {s.number != null ? `${s.number}. ` : ""}
                              {s.stem}
                            </p>
                          )}
                          {s.options.length > 0 && (
                            <p className="line-clamp-2 text-neutral-400">
                              {s.options.map((o) => `${o.label}. ${o.text}`).join("   ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quiz.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                active={q.id === activeId}
                menuOpen={menuId === q.id}
                canDelete={canDelete}
                aiReasoning={aiReasoning[q.id]}
                registerRef={registerRef}
                setActiveId={setActiveId}
                onToggleMenu={toggleMenu}
                onCloseMenu={closeMenu}
                deleteQuestion={deleteQuestion}
                setStem={setStem}
                setImage={setImage}
                setAnswerText={setAnswerText}
                setExplanation={setExplanation}
                setOptionText={setOptionText}
                setCorrect={setCorrect}
                addOption={addOption}
                deleteOption={deleteOption}
              />
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-4 text-sm font-medium text-neutral-500 transition hover:border-neutral-400 hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Add question
            </button>
          </div>
        </main>
      </div>

      {/* ---- Preview (try the quiz, then return to editing) ---- */}
      {previewing && (
        <div className="fixed inset-0 z-40">
          <QuizPlayer
            quiz={quiz}
            onExit={() => setPreviewing(false)}
            exitLabel="Back to editing"
          />
        </div>
      )}

      {/* ---- Sign-in gate (publishing needs an account: Google or local) ---- */}
      {signInOpen && <AccountModal account={null} onClose={() => setSignInOpen(false)} />}

      {/* ---- Publish dialog ---- */}
      {publishOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm"
          onClick={() => !publishing && setPublishOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Publish quiz"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white">
                <Upload />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Publish quiz</h2>
                <p className="text-sm text-neutral-500">
                  Save it to your library to review or share.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium text-neutral-700">Quiz name</label>
            <input
              autoFocus
              value={publishName}
              onChange={(e) => setPublishName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPublish();
                }
                if (e.key === "Escape") setPublishOpen(false);
              }}
              placeholder="e.g. Microeconomics — Final review"
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-300 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <Grid className="h-3.5 w-3.5" />
                {quiz.questions.length}{" "}
                {quiz.questions.length === 1 ? "question" : "questions"}
              </span>
              {needsReview > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                  <Alert className="h-3 w-3" />
                  {needsReview} still flagged
                </span>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                disabled={publishing}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPublish}
                disabled={publishing || !publishName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-default disabled:opacity-40"
              >
                {publishing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Upload />
                )}
                {publishing ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Unsaved-changes guard (in-app navigation) ---- */}
      {leaveTo !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm"
          onClick={() => setLeaveTo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <Alert />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  Save changes before leaving?
                </h2>
                <p className="text-sm text-neutral-500">
                  You have unsaved edits to this quiz. They&rsquo;ll be lost if you leave.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveTo(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={discardAndLeave}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Leave without saving
              </button>
              <button
                type="button"
                onClick={saveAndLeave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                <Upload />
                Save &amp; leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
