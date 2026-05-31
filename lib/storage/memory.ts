import type { Quiz } from "../domain/types";
import type { QuizStore } from "./types";

/** Minimal in-memory store for v1. Don't over-invest in persistence yet. */
export function createMemoryStore(): QuizStore {
  const db = new Map<string, Quiz>();
  return {
    async save(quiz) {
      db.set(quiz.id, quiz);
    },
    async get(id) {
      return db.get(id) ?? null;
    },
    async list() {
      return [...db.values()];
    },
  };
}
