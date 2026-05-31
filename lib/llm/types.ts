import type { Question } from "../domain/types";

export interface LlmRefineInput {
  /** Raw text of the document (or just the low-confidence span). */
  text: string;
  /** Best-effort questions the deterministic parser already produced. */
  draft: Question[];
}

/**
 * Optional, swappable LLM fallback.
 *
 * The deterministic parser is the REAL engine. This is invoked only for
 * low-confidence documents, and only when `enabled` is true. No provider is
 * hardwired — implement this interface against any LLM. The app must be fully
 * functional with this disabled (see `disabledLlmClient`).
 */
export interface LlmClient {
  readonly enabled: boolean;
  refine(input: LlmRefineInput): Promise<Question[]>;
}
