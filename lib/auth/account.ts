/**
 * Local-first account — a lightweight identity stored on this device. It's the
 * seam for future quiz sharing (published quizzes get stamped with an `ownerId`),
 * but nothing in the app requires it: every feature works signed out. There is no
 * password, no backend, and no network here — this is a local profile persisted
 * in localStorage, the same way the quiz library is.
 *
 * Reactivity is a tiny module-level store exposed through `useAccount`, so the
 * header and any future sharing UI stay in sync without a context provider. The
 * stored value is read lazily on first mount (not at import time) so the initial
 * client render matches the server's signed-out render — no hydration mismatch.
 */
import { useEffect, useSyncExternalStore } from "react";

export interface Account {
  id: string;
  /** Display name. */
  name: string;
  /** Optional contact, stored locally only. */
  email?: string;
  createdAt: string;
}

const KEY = "pdfquiz:account";

let current: Account | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    if (current) window.localStorage.setItem(KEY, JSON.stringify(current));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage disabled / quota — ignore */
  }
}

/** Read the stored account once, client-side. Idempotent and cheap, so it's safe
 *  to call on every mount. Kept out of module init so the first client render
 *  matches the (signed-out) server render. */
function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      current = JSON.parse(raw) as Account;
      emit();
    }
  } catch {
    /* malformed — stay signed out */
  }
}

function makeId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `acct_${rand}`;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The current account, or null when signed out. Non-reactive; use `useAccount`
 *  inside components. */
export function getAccount(): Account | null {
  return current;
}

/** Create the local account, or update name/email if one already exists. */
export function saveAccount(name: string, email?: string): Account {
  const cleanName = name.trim() || "You";
  const cleanEmail = email?.trim() || undefined;
  current = current
    ? { ...current, name: cleanName, email: cleanEmail }
    : { id: makeId(), name: cleanName, email: cleanEmail, createdAt: new Date().toISOString() };
  persist();
  emit();
  return current;
}

/** Forget the local account. Does not touch the quiz library — quizzes keep the
 *  `ownerId` they were stamped with. */
export function signOut(): void {
  current = null;
  persist();
  emit();
}

/** Reactive access to the current account in client components. */
export function useAccount(): Account | null {
  useEffect(() => {
    hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getAccount, () => null);
}

/** Up-to-two-letter initials for an avatar, derived from the name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
