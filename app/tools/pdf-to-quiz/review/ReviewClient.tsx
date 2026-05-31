"use client";

import { useEffect, useState } from "react";
import type { Quiz } from "@/lib/domain/types";
import { QuizEditor } from "@/components/quiz-editor/QuizEditor";
import { sampleQuiz } from "@/lib/domain/sample-quiz";
import { getQuiz } from "@/lib/storage/quiz-library";

const STORAGE_KEY = "pdfquiz:current";

/**
 * Hydrates the review editor, in priority order:
 *   1. "?sample=1"  → the bundled demo (bypasses everything)
 *   2. "?id=<id>"   → a published quiz reopened from the library
 *   3. sessionStorage → the quiz the uploader just stashed
 *   4. fallback      → the bundled sample
 */
export function ReviewClient() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("sample") === "1") {
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
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  const active = quiz ?? sampleQuiz;
  return <QuizEditor key={active.id} initial={active} />;
}
