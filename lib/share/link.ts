/**
 * Link-based quiz sharing — no backend, no upload. A quiz is serialized into a
 * compact token that rides in the URL *fragment* (`/import#q=…`). Because the
 * fragment never leaves the browser (it isn't sent to any server), the quiz's
 * content stays private to whoever holds the link: we host nothing.
 *
 * Wire format:  <scheme><base64url-payload>
 *   scheme "g" → payload is gzip(JSON)         (the normal path)
 *   scheme "r" → payload is raw UTF-8 JSON      (fallback if CompressionStream
 *                                                isn't available)
 *
 * Images are stripped before serialization: a question's pixels live in
 * IndexedDB on the *origin* device (only a reference travels in the quiz JSON),
 * so they can't follow a link to another machine. The shared copy is text-only.
 */
import type { Question, Quiz, QuizSource } from "@/lib/domain/types";
import { newQuizId } from "@/lib/domain/ids";

/** The query key carried in the import URL's hash. */
export const SHARE_PARAM = "q";

// ---- base64url <-> bytes ----------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  // Chunked to avoid blowing the call stack on big argument lists.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- gzip via the platform streams (guarded; not in every browser) ----------

interface ByteTransform {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}
type TransformCtor = new (format: "gzip") => ByteTransform;

function streamCtors(): { CS?: TransformCtor; DS?: TransformCtor } {
  const g = globalThis as unknown as { CompressionStream?: TransformCtor; DecompressionStream?: TransformCtor };
  return { CS: g.CompressionStream, DS: g.DecompressionStream };
}

async function pipe(bytes: Uint8Array, transform: ByteTransform): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// ---- strip / revive ---------------------------------------------------------

/** Shrink a quiz to its shareable essence: drop image refs (bytes can't travel)
 *  and the review-only `skipped` blocks. */
function stripForShare(quiz: Quiz): Quiz {
  return {
    id: quiz.id,
    title: quiz.title,
    source: quiz.source,
    createdAt: quiz.createdAt,
    questions: quiz.questions.map(({ image, ...rest }) => {
      void image;
      return rest;
    }),
  };
}

/** Validate a decoded payload just enough to trust it, and stamp a *fresh* id so
 *  importing a link never overwrites an existing library quiz with the same id. */
function reviveSharedQuiz(data: unknown): Quiz {
  if (!data || typeof data !== "object") throw new Error("This share link is empty or malformed.");
  const q = data as Partial<Quiz>;
  if (!Array.isArray(q.questions) || q.questions.length === 0) {
    throw new Error("This link doesn’t contain any questions.");
  }
  return {
    id: newQuizId(),
    title: typeof q.title === "string" && q.title.trim() ? q.title : "Shared quiz",
    source: q.source && typeof q.source === "object" ? (q.source as QuizSource) : { type: "text" },
    questions: q.questions as Question[],
    createdAt: typeof q.createdAt === "string" ? q.createdAt : new Date().toISOString(),
  };
}

// ---- public API -------------------------------------------------------------

/** Serialize a quiz into a share token (gzip+base64url, with a raw fallback). */
export async function encodeQuiz(quiz: Quiz): Promise<string> {
  const json = JSON.stringify(stripForShare(quiz));
  const utf8 = new TextEncoder().encode(json);
  const { CS } = streamCtors();
  if (CS) {
    try {
      const gz = await pipe(utf8, new CS("gzip"));
      return `g${bytesToBase64Url(gz)}`;
    } catch {
      /* fall back to raw below */
    }
  }
  return `r${bytesToBase64Url(utf8)}`;
}

/** Reverse {@link encodeQuiz}. Returns a quiz with a brand-new id, ready to save
 *  into the local library. Throws on an unrecognized/corrupt token. */
export async function decodeQuiz(token: string): Promise<Quiz> {
  const scheme = token[0];
  const bytes = base64UrlToBytes(token.slice(1));
  let utf8: Uint8Array;
  if (scheme === "g") {
    const { DS } = streamCtors();
    if (!DS) throw new Error("This browser can’t open compressed share links.");
    utf8 = await pipe(bytes, new DS("gzip"));
  } else if (scheme === "r") {
    utf8 = bytes;
  } else {
    throw new Error("Unrecognized share link.");
  }
  return reviveSharedQuiz(JSON.parse(new TextDecoder().decode(utf8)));
}

/** Build the full, copy-pasteable import URL for a token. */
export function shareUrlFromToken(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/import#${SHARE_PARAM}=${token}`;
}

/** Convenience: quiz → ready-to-share URL. */
export async function buildShareLink(quiz: Quiz): Promise<string> {
  return shareUrlFromToken(await encodeQuiz(quiz));
}

/** Pull the share token out of a URL hash (`#q=…`), or null if absent. */
export function tokenFromHash(hash: string): string | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const value = new URLSearchParams(h).get(SHARE_PARAM);
  return value && value.trim() ? value.trim() : null;
}
