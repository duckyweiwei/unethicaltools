"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz } from "@/lib/domain/types";
import { QuizPlayer } from "@/components/quiz-player/QuizPlayer";
import { sampleQuiz } from "@/lib/domain/sample-quiz";
import { getQuiz } from "@/lib/storage/quiz-library";

const STORAGE_KEY = "pdfquiz:current";

/**
 * Merge several published quizzes into one run, so multiple sets can be studied
 * or tested together. Question ids are namespaced by their origin quiz so they
 * stay unique in the combined run, and each question is tagged with its source
 * quiz's title (surfaced by the player's "show source" toggle). A single quiz is
 * returned unchanged.
 */
function combineQuizzes(quizzes: Quiz[]): Quiz {
  if (quizzes.length === 1) return quizzes[0];
  return {
    id: "combined:" + quizzes.map((q) => q.id).join("+"),
    title: `${quizzes.length} quizzes combined`,
    source: quizzes[0]?.source ?? { type: "text" },
    createdAt: new Date().toISOString(),
    questions: quizzes.flatMap((q) =>
      q.questions.map((question) => ({
        ...question,
        id: `${q.id}::${question.id}`,
        sourceLabel: q.title,
      })),
    ),
  };
}

/**
 * Hydrates the player, in priority order:
 *   1. "?sample=1"     → the bundled demo
 *   2. "?ids=a,b,c"    → several published quizzes, combined into one run
 *   3. "?id=<id>"      → a published quiz from the library
 *   4. sessionStorage  → the most recent upload
 *   5. fallback        → the bundled sample
 */
export function PlayClient() {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("sample") === "1") {
      setLoaded(true);
      return;
    }

    const idsParam = params.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const found: Quiz[] = [];
      for (const qid of ids) {
        const stored = getQuiz(qid);
        if (stored) found.push(stored);
      }
      if (found.length > 0) setQuiz(combineQuizzes(found));
      setLoaded(true);
      return;
    }

    const id = params.get("id");
    if (id) {
      const stored = getQuiz(id);
      if (stored) setQuiz(stored);
      setLoaded(true);
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setQuiz(JSON.parse(raw) as Quiz);
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center bg-neutral-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  const active = quiz ?? sampleQuiz;
  // `inShell`: this route renders inside the global AppShell (see play/page.tsx),
  // so the player drops its own full top bar. `onExit` stays as a safe fallback
  // but the shell's toolbar is the primary way back out.
  return (
    <QuizPlayer
      key={active.id}
      quiz={active}
      inShell
      onExit={() => router.push("/library")}
      exitLabel="Back to library"
    />
  );
}
