/**
 * Local quiz library — the persistent "folder" of everything the user has
 * published. Backed by localStorage (no account/backend yet), so it survives
 * reloads and is per-browser. Source-agnostic: any tool that produces a `Quiz`
 * can publish into the same library.
 *
 * All functions are SSR-safe: on the server (no `window`) they no-op / return
 * empty, so importing this module from a client component never crashes during
 * prerender.
 */
import type { Quiz } from "@/lib/domain/types";

const KEY = "pdfquiz:library";

export interface StoredQuiz extends Quiz {
  /** ISO timestamp of the most recent publish. */
  publishedAt: string;
}

function read(): StoredQuiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredQuiz[]) : [];
  } catch {
    return [];
  }
}

function write(list: StoredQuiz[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

/** Every published quiz, newest first. */
export function listQuizzes(): StoredQuiz[] {
  return read().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/** A single published quiz by id, or null if not in the library. */
export function getQuiz(id: string): StoredQuiz | null {
  return read().find((q) => q.id === id) ?? null;
}

/**
 * Publish a quiz into the library. Upserts by `quiz.id`, so re-publishing an
 * edited quiz updates its card in place rather than creating a duplicate.
 */
export function saveQuiz(quiz: Quiz): StoredQuiz {
  const list = read();
  const record: StoredQuiz = { ...quiz, publishedAt: new Date().toISOString() };
  const idx = list.findIndex((q) => q.id === quiz.id);
  if (idx === -1) list.push(record);
  else list[idx] = record;
  write(list);
  return record;
}

/** Remove a quiz from the library. */
export function deleteQuiz(id: string): void {
  write(read().filter((q) => q.id !== id));
}
