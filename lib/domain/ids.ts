function rand(n = 6): string {
  return Math.random().toString(36).slice(2, 2 + n);
}

export const newQuizId = (): string => `quiz_${rand(8)}`;

export const newQuestionId = (n?: number | null): string =>
  n != null ? `q_${String(n).padStart(3, "0")}` : `q_${rand(6)}`;

/** Key for an image stored in IndexedDB (lib/storage/image-store.ts). Random,
 *  never derived from filename, so two uploads never collide. */
export const newImageId = (): string => `img_${rand(10)}`;
