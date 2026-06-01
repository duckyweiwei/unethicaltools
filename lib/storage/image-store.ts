/**
 * Image byte store — the home for question images, kept deliberately separate
 * from the quiz library.
 *
 * Why a second store? Quizzes are JSON in localStorage, which caps out around
 * 5MB per origin; a handful of photos would blow that quota and corrupt every
 * quiz at once. Images instead live in IndexedDB (effectively unbounded, browser-
 * managed), keyed by a random id. The quiz JSON carries only a tiny `QuestionImage`
 * reference (the id + alt/dims) — so publishing, combining, and editing a quiz
 * never moves a single pixel, and the bytes are fetched lazily where they render.
 *
 * Values are stored as dataURL strings (not Blobs + object URLs): a dataURL is
 * self-contained, survives reloads, and drops straight into an <img src> with no
 * lifecycle to manage (no URL.revokeObjectURL, no dangling handles).
 *
 * Everything here is SSR-safe: on the server (no `indexedDB`) the primitives
 * reject/no-op and `useImage` returns null, so importing this from a client
 * component never breaks prerender.
 */
import { useEffect, useState } from "react";
import type { QuestionImage } from "@/lib/domain/types";
import { newImageId } from "@/lib/domain/ids";

const DB_NAME = "pdfquiz";
const STORE = "images";
const VERSION = 1;

/** Largest single image we'll accept, pre-encoding. Generous enough for slide
 *  screenshots and diagrams; a guard against someone attaching a 50MP photo. */
const MAX_BYTES = 10 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  // If the open fails, clear the cache so a later call can retry from scratch.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Persist (or overwrite) an image's bytes under `id`. */
export async function putImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("putImage failed"));
  });
}

/** Read an image's dataURL, or null if there's nothing stored under `id`. */
export async function getImage(id: string): Promise<string | null> {
  const db = await openDb();
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("getImage failed"));
  });
}

/** Drop an image's bytes. Safe to call for an id that isn't present. */
export async function deleteImage(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("deleteImage failed"));
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Decode a dataURL just far enough to read its intrinsic size. Best-effort:
 *  callers tolerate a rejection (the ref simply omits width/height). */
function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("decode failed"));
    img.src = dataUrl;
  });
}

/**
 * Take a user-picked File, stash its bytes in IndexedDB, and return the tiny
 * `QuestionImage` reference to record on the question. Faithful by design — the
 * file is stored as-is, never re-compressed (this product never rewrites the
 * user's content). Rejects non-images and anything over MAX_BYTES with a message
 * suitable to show inline.
 */
export async function storeImageFile(file: File): Promise<QuestionImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large (max 10MB).");
  }
  const dataUrl = await fileToDataUrl(file);
  const dims = await measure(dataUrl).catch(() => null);
  const id = newImageId();
  await putImage(id, dataUrl);
  return { id, alt: "", width: dims?.width, height: dims?.height };
}

/**
 * Reactively load an image's dataURL by id for rendering. Returns null while
 * loading, when `id` is absent, or when the bytes are missing (e.g. a stale
 * reference) — callers render nothing in that case, so a lost image degrades
 * gracefully instead of throwing.
 */
export function useImage(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let active = true;
    getImage(id)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return url;
}

/* ------------------------------------------------------------------ *
 * Review tray — figures auto-extracted from the just-imported PDF.
 *
 * The parse route hands back decoded figures with no position, so we can't say
 * which question each belongs to. Instead of guessing (and mis-attaching logos),
 * the uploader writes their bytes to IndexedDB like any other image and leaves a
 * lightweight manifest HERE in sessionStorage, keyed by the freshly-minted quiz
 * id. The review editor reads it to offer "attach this figure to a question,"
 * then clears it on publish. Kept out of the quiz JSON so an unattached figure
 * never pollutes a saved quiz, and naturally discarded when the tab closes.
 * ------------------------------------------------------------------ */

/** One attachable figure; its bytes already live in IndexedDB under `id`. */
export interface TrayImage {
  id: string;
  /** 1-based source page — a hint shown on the thumbnail. */
  page: number;
  /** Originating file name, surfaced when several PDFs were combined. */
  sourceLabel?: string;
  width: number;
  height: number;
}

const TRAY_KEY = "pdfquiz:current-images";

interface TrayPayload {
  quizId: string;
  images: TrayImage[];
}

/** Persist (or clear) the tray manifest for a quiz. No-op without sessionStorage. */
export function writeTray(quizId: string, images: TrayImage[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (images.length) {
      sessionStorage.setItem(TRAY_KEY, JSON.stringify({ quizId, images } satisfies TrayPayload));
    } else {
      sessionStorage.removeItem(TRAY_KEY);
    }
  } catch {
    // private-mode quota / storage disabled — the tray is a nicety, not load-bearing
  }
}

/** Read the tray for `quizId`; empty if absent, malformed, or for another quiz. */
export function readTray(quizId: string): TrayImage[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(TRAY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrayPayload;
    if (parsed?.quizId !== quizId || !Array.isArray(parsed.images)) return [];
    return parsed.images;
  } catch {
    return [];
  }
}

/** Forget the tray manifest (after publish, or once the user empties it). */
export function clearTray(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(TRAY_KEY);
  } catch {
    /* ignore */
  }
}
