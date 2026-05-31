"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz, Question, QuestionOption, SkippedItem } from "@/lib/domain/types";
import { scoreQuestion } from "@/lib/importers/pdf/parser/confidence";
import { newQuestionId } from "@/lib/domain/ids";
import { saveQuiz } from "@/lib/storage/quiz-library";
import { QuizPlayer } from "@/components/quiz-player/QuizPlayer";
import {
  Alert,
  Check,
  ChevronLeft,
  Close,
  Dots,
  Folder,
  Grid,
  Pencil,
  Play,
  Plus,
  Trash,
  Upload,
} from "./icons";

const LETTERS = "ABCDEFGHIJ".split("");

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
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

/** A skipped block plus a stable uid for list keys / removal. */
interface SkippedRow extends SkippedItem {
  uid: string;
}

export function QuizEditor({ initial }: { initial: Quiz }) {
  const [quiz, setQuiz] = useState<Quiz>(() => ({
    ...initial,
    questions: initial.questions.map(rescore),
    skipped: undefined, // held separately below; never part of the saved quiz
  }));
  // Blocks the parser couldn't auto-import. Kept outside `quiz` so they never
  // publish; each is the user's to promote into a real question or dismiss.
  const [skipped, setSkipped] = useState<SkippedRow[]>(() =>
    (initial.skipped ?? []).map((s, i) => ({ ...s, uid: `sk-${i}` })),
  );
  const [activeId, setActiveId] = useState<string>(initial.questions[0]?.id ?? "");
  const [menuId, setMenuId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const router = useRouter();
  const [previewing, setPreviewing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishing, setPublishing] = useState(false);

  function patchQuestion(id: string, fn: (q: Question) => Question) {
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? rescore(fn(q)) : q)),
    }));
  }

  const setStem = (id: string, stem: string) =>
    patchQuestion(id, (q) => ({ ...q, stem }));

  const setExplanation = (id: string, explanation: string) =>
    patchQuestion(id, (q) => ({ ...q, explanation: explanation === "" ? null : explanation }));

  const setOptionText = (id: string, label: string, text: string) =>
    patchQuestion(id, (q) => ({
      ...q,
      options: q.options.map((o) => (o.label === label ? { ...o, text } : o)),
    }));

  const setCorrect = (id: string, label: string) =>
    patchQuestion(id, (q) => ({ ...q, correct: q.correct === label ? null : label }));

  const addOption = (id: string) =>
    patchQuestion(id, (q) => ({
      ...q,
      options: relabel([...q.options, { label: LETTERS[q.options.length] ?? "?", text: "" }]),
    }));

  const deleteOption = (id: string, label: string) =>
    patchQuestion(id, (q) => {
      const idx = q.options.findIndex((o) => o.label === label);
      if (idx === -1) return q;
      const wasCorrectIdx = q.correct
        ? q.options.findIndex((o) => o.label === q.correct)
        : -1;
      const remaining = relabel(q.options.filter((_, i) => i !== idx));
      let correct: string | null = null;
      if (wasCorrectIdx !== -1 && wasCorrectIdx !== idx) {
        const ni = wasCorrectIdx > idx ? wasCorrectIdx - 1 : wasCorrectIdx;
        correct = remaining[ni]?.label ?? null;
      }
      return { ...q, options: remaining, correct };
    });

  function selectQuestion(id: string) {
    setActiveId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  /** Turn a skipped block into a real, editable question and append it. We pad
   *  to >=2 options (a valid MCQ) and re-letter, then drop it from the list. */
  function promoteSkipped(uid: string) {
    const item = skipped.find((s) => s.uid === uid);
    if (!item) return;
    const padded = [...item.options];
    while (padded.length < 2) padded.push({ label: "?", text: "" });
    const q = rescore({
      id: newQuestionId(),
      number: quiz.questions.length + 1,
      type: "mcq",
      stem: item.stem,
      options: relabel(padded),
      correct: null,
      explanation: null,
      confidence: 1,
      flags: [],
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

  function deleteQuestion(id: string) {
    const idx = quiz.questions.findIndex((q) => q.id === id);
    const remaining = quiz.questions.filter((q) => q.id !== id);
    setQuiz((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
    setMenuId(null);
    if (id === activeId) setActiveId((remaining[idx] ?? remaining[idx - 1])?.id ?? "");
  }

  function openPublish() {
    setPublishName(quiz.title.trim() || "Untitled quiz");
    setPublishOpen(true);
  }

  function confirmPublish() {
    const name = publishName.trim();
    if (!name) return;
    setPublishing(true);
    const next: Quiz = { ...quiz, title: name };
    setQuiz(next);
    saveQuiz(next);
    router.push("/library");
  }

  const needsReview = quiz.questions.filter((q) => q.flags.length > 0).length;
  // The source PDF carried no detectable answer key when nothing is marked
  // correct. Surfaced as a banner so a question-only bank doesn't silently
  // become an ungradeable quiz; it clears the moment any answer is set.
  const noAnswerKey =
    quiz.questions.length > 0 && quiz.questions.every((q) => q.correct == null);

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
      {/* ---- Top bar ---- */}
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <a
            href="/tools/pdf-to-quiz"
            className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
            aria-label="Back"
          >
            <ChevronLeft />
          </a>
          <span className="truncate text-sm text-neutral-400">
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
          <a
            href="/library"
            className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 sm:flex"
          >
            <Folder />
            My quizzes
          </a>
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
            {quiz.questions.map((q, i) => {
              const active = q.id === activeId;
              const flagged = q.flags.length > 0;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => selectQuestion(q.id)}
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
                      {i + 1}
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
                    <Grid className="h-3.5 w-3.5" />
                    <span className="text-xs">Multiple choice</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---- Editor column ---- */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
            {noAnswerKey && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm">
                <Alert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">No answer key found in this PDF</p>
                  <p className="mt-0.5 text-amber-700">
                    This looks like a question-only bank — we couldn&rsquo;t detect any marked
                    correct answers. Click the circle next to the right choice on each question to
                    set it, otherwise there&rsquo;s nothing to grade against when you study.
                  </p>
                </div>
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

            {quiz.questions.map((q, i) => {
              const flagged = q.flags.length > 0;
              return (
                <section
                  key={q.id}
                  ref={(el) => {
                    cardRefs.current[q.id] = el;
                  }}
                  onMouseDown={() => setActiveId(q.id)}
                  className={cx(
                    "relative rounded-2xl border bg-white p-6 shadow-sm transition",
                    q.id === activeId ? "border-neutral-300 shadow-md" : "border-neutral-200",
                  )}
                >
                  {/* card header */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm font-medium text-neutral-700">
                      <span className="grid h-5 w-5 place-items-center rounded bg-neutral-900 text-white">
                        <Grid className="h-3 w-3" />
                      </span>
                      Multiple choice
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
                          onClick={() => setMenuId(menuId === q.id ? null : q.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100"
                          aria-label="Question options"
                        >
                          <Dots />
                        </button>
                        {menuId === q.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => deleteQuestion(q.id)}
                                disabled={quiz.questions.length <= 1}
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
                  <div className="mt-5 text-sm font-semibold text-neutral-800">
                    Question {i + 1}
                  </div>

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

                  {/* choices */}
                  <div className="mt-5 text-sm font-medium text-neutral-700">Choices</div>
                  <div className="mt-3 space-y-2">
                    {q.options.map((o) => {
                      const correct = q.correct === o.label;
                      return (
                        <div key={o.label} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setCorrect(q.id, o.label)}
                            aria-pressed={correct}
                            aria-label={`Mark option ${o.label} correct`}
                            className={cx(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
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
                    disabled={q.options.length >= LETTERS.length}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-default disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    Add option
                  </button>

                  {flagged && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <Alert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Needs review — {q.flags.join("; ")}. Pick the correct answer to clear this.
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
            })}

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
    </div>
  );
}
