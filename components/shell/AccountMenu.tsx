"use client";

/**
 * The header's account control. There are now two kinds of identity:
 *
 *   • Google sign-in (real, cross-device) — when present it takes priority and
 *     can carry a paid "Pro" entitlement. Signing out calls Auth.js.
 *   • A local-first profile (no backend, this device only) — the signed-out
 *     fallback, unchanged. Every feature still works with neither.
 *
 * Signed in with Google we show the avatar + a Pro pill / Upgrade link; otherwise
 * we show the local profile, and the sign-in modal now really starts Google OAuth.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signIn, signOut as signOutGoogle, useSession } from "next-auth/react";
import {
  useAccount,
  saveAccount,
  signOut as signOutLocal,
  initials,
  type Account,
} from "@/lib/auth/account";
import { useEntitlement } from "@/lib/auth/entitlement-client";
import { Close } from "@/components/quiz-editor/icons";

export function AccountMenu() {
  const { data: session } = useSession();
  // A real Google session wins over the local profile.
  if (session?.user) return <GoogleAccount user={session.user} />;
  return <LocalAccount />;
}

/** Dismiss-on-outside-click / Escape, shared by both dropdowns. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

// ---- Google (real) identity ------------------------------------------------

function GoogleAccount({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pro } = useEntitlement();
  useDismiss(open, () => setOpen(false), ref);

  const label = user.name || user.email || "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-neutral-900 text-xs font-semibold text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 object-cover"
          />
        ) : (
          initials(label)
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-neutral-900">{label}</p>
              {pro && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Pro
                </span>
              )}
            </div>
            {user.email && <p className="truncate text-xs text-neutral-500">{user.email}</p>}
            <p className="mt-1 text-[11px] text-neutral-400">Signed in with Google</p>
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          {!pro && (
            <a
              role="menuitem"
              href="/upgrade"
              className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Upgrade to Pro
            </a>
          )}
          <a
            role="menuitem"
            href="/library"
            className="block w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
          >
            My quizzes
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void signOutGoogle();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Local-first profile (signed-out fallback) -----------------------------

function LocalAccount() {
  const account = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuOpen, () => setMenuOpen(false), menuRef);

  if (!account) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-full border border-neutral-200 px-3.5 py-2 text-sm font-medium text-neutral-700 outline-none transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Sign in
        </button>
        {editOpen && <AccountModal account={null} onClose={() => setEditOpen(false)} />}
      </>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={account.name}
        className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        {initials(account.name)}
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-neutral-900">{account.name}</p>
            {account.email && <p className="truncate text-xs text-neutral-500">{account.email}</p>}
            <p className="mt-1 text-[11px] text-neutral-400">Saved on this device</p>
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void signIn("google");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            <GoogleGlyph className="h-4 w-4" /> Sign in with Google
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
          >
            Edit profile
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              signOutLocal();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      )}
      {editOpen && <AccountModal account={account} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

/** Google's multi-colour "G", inline so we ship no brand asset / network call. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Create / edit the local profile, led by the standard account options. The
 * "Continue with Google" button now really starts Google OAuth (Auth.js); the
 * local profile below stays as a no-account-needed option. Portalled to <body>
 * because the header's `backdrop-blur` is a containing block for `position:fixed`.
 */
export function AccountModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!name.trim()) return;
    saveAccount(name, email);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={account ? "Edit profile" : "Sign in"}
        className="relative z-10 my-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {account ? "Edit profile" : "Sign in or sign up"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        {!account && (
          <>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              Sign in with Google for a real, cross-device account that carries Pro — there’s no
              password to set up here, Google handles that.
            </p>

            <button
              type="button"
              onClick={() => void signIn("google")}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 outline-none transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              <GoogleGlyph className="h-[18px] w-[18px]" />
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-200" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                or just this device
              </span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <p className="text-[12px] leading-relaxed text-neutral-400">
              Save a name to personalize this browser. It’s a local profile, not an account — no
              password, not synced, and Pro isn’t available on it.
            </p>
          </>
        )}

        {account && (
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">Update how you show up.</p>
        )}

        <label className="mt-1 block text-xs font-medium text-neutral-500">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Your name"
          aria-label="Name"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900/10"
        />

        <label className="mt-3 block text-xs font-medium text-neutral-500">
          Email <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="you@example.com"
          aria-label="Email (optional)"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900/10"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {account ? "Save" : "Save to this device"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
