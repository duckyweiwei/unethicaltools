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
import type {
  Question,
  QuestionImage,
  QuestionOption,
  QuestionType,
  Quiz,
  SkippedItem,
  SourceType,
} from "@/lib/domain/types";
import { getAccount } from "@/lib/auth/account";
import { DEFAULT_FOLDER_COLOR, type FolderColor } from "@/lib/folder-colors";
import {
  asArray,
  asEnum,
  asFiniteNumber,
  asNullableNumber,
  asNullableString,
  asString,
  asStringArray,
  isRecord,
} from "@/lib/storage/coerce";

const KEY = "pdfquiz:library";
const FOLDERS_KEY = "pdfquiz:folders";

/** Closed sets used when normalizing untrusted stored quizzes. */
const QUESTION_TYPES: readonly QuestionType[] = ["mcq", "true_false", "cloze", "matching", "open"];
const SOURCE_TYPES: readonly SourceType[] = ["pdf", "docx", "image", "text", "ai"];

export interface StoredQuiz extends Quiz {
  /** ISO timestamp of the most recent publish. */
  publishedAt: string;
  /** Folder this quiz is filed under. `undefined`/`null` means unfiled. */
  folderId?: string | null;
  /** The local account that published this quiz, if one existed at publish time.
   *  The seam for future sharing; `null`/`undefined` for quizzes made signed out. */
  ownerId?: string | null;
}

/** A user-created grouping for quizzes. Folders are organizational only — a quiz
 *  lives in the library whether or not it's filed, and deleting a folder unfiles
 *  (never deletes) its quizzes. */
export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  /** One of the six accent colours (see lib/folder-colors). Optional: folders
   *  created before colours existed fall back to the default when rendered. */
  color?: FolderColor;
}

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

/** A QuestionImage REFERENCE (the pixels live in IndexedDB, keyed by `id`). We
 *  only keep it when it carries a real `id`; the optional alt/dimensions are
 *  preserved when present so the player can still reserve aspect-ratio space. */
function normalizeImageRef(raw: unknown): QuestionImage | undefined {
  if (!isRecord(raw)) return undefined;
  const id = asString(raw.id);
  if (!id) return undefined;
  const ref: QuestionImage = { id };
  if (typeof raw.alt === "string") ref.alt = raw.alt;
  if (typeof raw.width === "number" && Number.isFinite(raw.width)) ref.width = raw.width;
  if (typeof raw.height === "number" && Number.isFinite(raw.height)) ref.height = raw.height;
  return ref;
}

function normalizeOption(raw: unknown): QuestionOption | null {
  if (!isRecord(raw)) return null;
  const opt: QuestionOption = { label: asString(raw.label), text: asString(raw.text) };
  // Per-option image (image-per-answer questions) — a reference into the image
  // store, carried through save/load like the stem image so it isn't dropped.
  const image = normalizeImageRef(raw.image);
  if (image) opt.image = image;
  return opt;
}

/** Repair one question's SHAPE. Every original field is preserved verbatim (the
 *  product promise is that nothing is rewritten) — we only guarantee that the
 *  fields the player/editor/card iterate or measure (`options`, `flags`,
 *  `correctSet`) are real arrays and the scalars are the right primitive, so a
 *  stale/corrupt question can't throw during render. Dropped only if it has no id. */
function normalizeQuestion(raw: unknown): Question | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    ...(raw as unknown as Question),
    id,
    type: asEnum<QuestionType>(raw.type, QUESTION_TYPES, "mcq"),
    number: asNullableNumber(raw.number),
    stem: asString(raw.stem),
    options: asArray(raw.options)
      .map(normalizeOption)
      .filter((x): x is QuestionOption => x !== null),
    correct: asNullableString(raw.correct),
    correctSet: Array.isArray(raw.correctSet)
      ? asStringArray(raw.correctSet)
      : raw.correctSet === null
        ? null
        : undefined,
    explanation: asNullableString(raw.explanation),
    confidence: asFiniteNumber(raw.confidence),
    flags: asStringArray(raw.flags),
  };
}

/** Repair one stored quiz's SHAPE so the library grid (which reads
 *  `quiz.questions.length` and maps each card) can never throw on a legacy or
 *  partially-written record. `questions` is guaranteed to be an array of
 *  well-formed questions; a record with no id is unusable and dropped. */
function normalizeStoredQuiz(raw: unknown): StoredQuiz | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const src = isRecord(raw.source) ? raw.source : {};
  return {
    ...(raw as unknown as StoredQuiz),
    id,
    title: asString(raw.title, "Untitled quiz"),
    source: {
      type: asEnum<SourceType>(src.type, SOURCE_TYPES, "pdf"),
      filename: typeof src.filename === "string" ? src.filename : undefined,
    },
    questions: asArray(raw.questions)
      .map(normalizeQuestion)
      .filter((x): x is Question => x !== null),
    skipped: Array.isArray(raw.skipped) ? (raw.skipped as SkippedItem[]) : undefined,
    createdAt: asString(raw.createdAt),
    publishedAt: asString(raw.publishedAt, asString(raw.createdAt)),
    folderId:
      raw.folderId === undefined ? undefined : typeof raw.folderId === "string" ? raw.folderId : null,
    ownerId:
      raw.ownerId === undefined ? undefined : typeof raw.ownerId === "string" ? raw.ownerId : null,
  };
}

function read(): StoredQuiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate-and-normalize every quiz so one legacy/corrupt entry can't make
    // the library throw mid-render (which looked like the "My quizzes" nav link
    // doing nothing).
    return parsed
      .map(normalizeStoredQuiz)
      .filter((x): x is StoredQuiz => x !== null);
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

/** True when this quiz belongs to the given signed-in owner. Legacy quizzes with
 *  no stamped owner (`null`/`undefined`) are treated as the current user's, so an
 *  upgrade never hides a device's existing library; they're claimed to the owner
 *  on the next save (see saveQuiz). */
function ownedBy(q: StoredQuiz, owner: string): boolean {
  return q.ownerId === owner || q.ownerId == null;
}

/** Every published quiz owned by the SIGNED-IN account, newest first. Signed out
 *  (no account) returns nothing — quizzes are private to the account that made
 *  them, so an anonymous visitor neither sees nor stores any. */
export function listQuizzes(): StoredQuiz[] {
  const owner = getAccount()?.id;
  if (!owner) return [];
  return read()
    .filter((q) => ownedBy(q, owner))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/** A single published quiz by id — but only if it belongs to the signed-in
 *  account. Null when signed out or when the quiz is owned by someone else, so a
 *  guessed/stale `?id=` can't surface another account's quiz. */
export function getQuiz(id: string): StoredQuiz | null {
  const owner = getAccount()?.id;
  if (!owner) return null;
  const q = read().find((x) => x.id === id) ?? null;
  return q && ownedBy(q, owner) ? q : null;
}

/**
 * Publish a quiz into the library. Upserts by `quiz.id`, so re-publishing an
 * edited quiz updates its card in place rather than creating a duplicate.
 */
export function saveQuiz(quiz: Quiz): StoredQuiz {
  const list = read();
  const idx = list.findIndex((q) => q.id === quiz.id);
  const prev = idx === -1 ? undefined : list[idx];
  // Folder membership is managed separately (setQuizFolder), so re-publishing an
  // edited quiz must keep whatever folder it was already filed under.
  const folderId = prev?.folderId;
  // Stamp the publishing account once; re-publishing keeps the original owner.
  const ownerId = prev?.ownerId ?? getAccount()?.id ?? null;
  const record: StoredQuiz = { ...quiz, publishedAt: new Date().toISOString(), folderId, ownerId };
  if (idx === -1) list.push(record);
  else list[idx] = record;
  write(list);
  return record;
}

/** Remove a quiz from the library. */
export function deleteQuiz(id: string): void {
  write(read().filter((q) => q.id !== id));
}

/** File a quiz under a folder, or pass `null` to unfile it. No-op if the quiz
 *  isn't in the library. */
export function setQuizFolder(quizId: string, folderId: string | null): void {
  const list = read();
  const idx = list.findIndex((q) => q.id === quizId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], folderId };
  write(list);
}

// ---- Folders ----------------------------------------------------------------

/** Repair one folder's SHAPE. Any stored `color` (or none) is coerced to a known
 *  swatch at render time by folderColor(), so we just keep a valid string here.
 *  Dropped only if it has no id. */
function normalizeFolder(raw: unknown): Folder | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, "Untitled folder"),
    createdAt: asString(raw.createdAt),
    color: typeof raw.color === "string" ? (raw.color as FolderColor) : undefined,
  };
}

function readFolders(): Folder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeFolder).filter((x): x is Folder => x !== null);
  } catch {
    return [];
  }
}

function writeFolders(list: Folder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

/** Every folder, alphabetized for a stable nav order. */
export function listFolders(): Folder[] {
  return readFolders().sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a folder and return it. Blank names fall back to a placeholder; an
 *  unspecified colour defaults to the house sky tint. */
export function createFolder(name: string, color: FolderColor = DEFAULT_FOLDER_COLOR): Folder {
  const folder: Folder = {
    id: makeId("fld"),
    name: name.trim() || "Untitled folder",
    createdAt: new Date().toISOString(),
    color,
  };
  const list = readFolders();
  list.push(folder);
  writeFolders(list);
  return folder;
}

/** Rename a folder in place. Blank names are ignored (keeps the old name). */
export function renameFolder(id: string, name: string): void {
  const next = name.trim();
  if (!next) return;
  const list = readFolders();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], name: next };
  writeFolders(list);
}

/** Recolor a folder in place. No-op if the folder isn't found. */
export function setFolderColor(id: string, color: FolderColor): void {
  const list = readFolders();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], color };
  writeFolders(list);
}

/** Delete a folder and unfile (never delete) any quizzes it held. */
export function deleteFolder(id: string): void {
  writeFolders(readFolders().filter((f) => f.id !== id));
  const quizzes = read();
  let changed = false;
  const next = quizzes.map((q) => {
    if (q.folderId === id) {
      changed = true;
      return { ...q, folderId: null };
    }
    return q;
  });
  if (changed) write(next);
}
