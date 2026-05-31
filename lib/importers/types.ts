import type { Quiz } from "../domain/types";

/**
 * An Importer turns some source into the shared Quiz model.
 *
 * The PDF importer implements this now. Future importers (docx, image, an AI
 * generator) implement the SAME signature and plug in unchanged — the review
 * screen and quiz player downstream don't change.
 */
export interface Importer<TSource = unknown> {
  /** Stable id, e.g. "pdf". */
  readonly id: string;
  parse(source: TSource): Promise<Quiz>;
}
