import type { Quiz } from "../domain/types";

/**
 * Persistence seam. v1 ships an in-memory implementation; swap for SQLite or
 * JSON files later without touching callers.
 */
export interface QuizStore {
  save(quiz: Quiz): Promise<void>;
  get(id: string): Promise<Quiz | null>;
  list(): Promise<Quiz[]>;
}
