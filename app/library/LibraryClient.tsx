"use client";

import { useEffect, useState } from "react";
import { listQuizzes, deleteQuiz, type StoredQuiz } from "@/lib/storage/quiz-library";
import { Folder, Grid, Pencil, Play, Plus, Trash } from "@/components/quiz-editor/icons";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * The quiz library ("folder") — every quiz the user has published, rendered as
 * a grid of cards. Reads from localStorage on mount (client-only, so we render
 * a spinner until hydrated to avoid an SSR mismatch).
 */
export function LibraryClient() {
  const [items, setItems] = useState<StoredQuiz[] | null>(null);

  useEffect(() => {
    setItems(listQuizzes());
  }, []);

  function remove(id: string) {
    deleteQuiz(id);
    setItems((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <a
          href="/"
          className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400 transition hover:text-neutral-600"
        >
          &larr; unethicaltools
        </a>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">My quizzes</h1>
            <p className="mt-2 text-[15px] text-neutral-500">
              Every quiz you&rsquo;ve published, ready to review or edit.
            </p>
          </div>
          <a
            href="/tools/pdf-to-quiz"
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Plus className="h-4 w-4" />
            New quiz
          </a>
        </div>

        <div className="mt-10">
          {items === null ? (
            <div className="flex justify-center py-24">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
                <Folder className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-700">No quizzes yet</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Publish a quiz and it&rsquo;ll show up here.
                </p>
              </div>
              <a
                href="/tools/pdf-to-quiz"
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Upload a PDF &rarr;
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((q) => (
                <div
                  key={q.id}
                  className="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => remove(q.id)}
                    aria-label={`Delete ${q.title}`}
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-neutral-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash className="h-4 w-4" />
                  </button>

                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-900 text-white">
                    <Grid className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
                    {q.title}
                  </h3>
                  <div className="mt-1 text-xs text-neutral-400">
                    {q.questions.length} {q.questions.length === 1 ? "question" : "questions"} ·{" "}
                    {formatDate(q.publishedAt)}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <a
                      href={`/tools/pdf-to-quiz/play?id=${encodeURIComponent(q.id)}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
                    >
                      <Play /> Study
                    </a>
                    <a
                      href={`/tools/pdf-to-quiz/review?id=${encodeURIComponent(q.id)}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
