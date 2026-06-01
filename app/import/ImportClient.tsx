"use client";

/**
 * Landing for an inbound share link (`/import#q=…`). The quiz is decoded from
 * the URL fragment entirely in the browser — we never see it — and previewed
 * before anything is written. Adding it saves a *personal copy* to this device's
 * local library (a fresh id, so it can't clobber an existing quiz). The original
 * owner isn't notified and nothing syncs to a server: this is link-based sharing,
 * not a hosted account.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { Quiz } from "@/lib/domain/types";
import { decodeQuiz, tokenFromHash } from "@/lib/share/link";
import { saveQuiz } from "@/lib/storage/quiz-library";
import { Check, Folder, Grid, Play, Share } from "@/components/quiz-editor/icons";

type Status = "loading" | "preview" | "empty" | "error" | "added";

export function ImportClient() {
  const [status, setStatus] = useState<Status>("loading");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenFromHash(window.location.hash);
    if (!token) {
      setStatus("empty");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = await decodeQuiz(token);
        if (!cancelled) {
          setQuiz(q);
          setStatus("preview");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "This share link couldn’t be opened.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addToLibrary() {
    if (!quiz) return;
    const saved = saveQuiz(quiz);
    setSavedId(saved.id);
    setStatus("added");
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-16">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">Opening shared quiz&hellip;</p>
        </div>
      )}

      {status === "empty" && (
        <Panel
          icon={<Share className="h-6 w-6" />}
          title="Nothing to import"
          body="This page imports a quiz from a share link. Open a link someone sent you, or share one of your own."
        >
          <Actions>
            <Secondary href="/library">My quizzes</Secondary>
            <Primary href="/tools/pdf-to-quiz">Convert a PDF</Primary>
          </Actions>
          <HowToShare />
        </Panel>
      )}

      {status === "error" && (
        <Panel
          icon={<Share className="h-6 w-6" />}
          title="Couldn’t open this link"
          tone="error"
          body={error ?? "The link looks corrupted or incomplete."}
        >
          <Actions>
            <Secondary href="/library">My quizzes</Secondary>
            <Primary href="/tools/pdf-to-quiz">Convert a PDF</Primary>
          </Actions>
        </Panel>
      )}

      {status === "preview" && quiz && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            <Share className="h-4 w-4" /> Shared with you
          </div>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900">
            {quiz.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}
          </p>

          <ul className="mt-4 space-y-1.5">
            {quiz.questions.slice(0, 3).map((q, i) => (
              <li key={q.id ?? i} className="flex gap-2 text-sm text-neutral-600">
                <span className="text-neutral-300">{i + 1}.</span>
                <span className="line-clamp-1">{q.stem}</span>
              </li>
            ))}
            {quiz.questions.length > 3 && (
              <li className="pl-5 text-xs text-neutral-400">
                + {quiz.questions.length - 3} more
              </li>
            )}
          </ul>

          <p className="mt-5 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] leading-relaxed text-neutral-500">
            Adding this saves a personal copy to <strong className="font-medium text-neutral-600">this device</strong>.
            Images don’t travel in a link, so a shared quiz is text-only. The original owner isn’t
            notified and nothing syncs to a server.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Secondary href="/library">Not now</Secondary>
            <button
              type="button"
              onClick={addToLibrary}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Add to my library
            </button>
          </div>
        </div>
      )}

      {status === "added" && quiz && savedId && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
            Added to your library
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            “{quiz.title}” is now in your quizzes on this device.
          </p>
          <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
            <a
              href={`/tools/pdf-to-quiz/play?id=${encodeURIComponent(savedId)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              <Play /> Study now
            </a>
            <a
              href={`/tools/pdf-to-quiz/review?id=${encodeURIComponent(savedId)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Grid className="h-4 w-4" /> Review &amp; edit
            </a>
            <a
              href="/library"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Folder className="h-4 w-4" /> My quizzes
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({
  icon,
  title,
  body,
  tone = "neutral",
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone?: "neutral" | "error";
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <span
        className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
          tone === "error" ? "bg-rose-50 text-rose-500" : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {icon}
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">{body}</p>
      {children}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex items-center justify-center gap-2">{children}</div>;
}

function Primary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
    >
      {children}
    </a>
  );
}

function Secondary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
    >
      {children}
    </a>
  );
}

function HowToShare() {
  return (
    <p className="mt-5 border-t border-neutral-100 pt-4 text-[12px] leading-relaxed text-neutral-400">
      To share: open <strong className="font-medium text-neutral-500">My quizzes</strong>, hover a
      quiz, and hit the share icon to copy a link. The quiz travels inside the link — we host
      nothing.
    </p>
  );
}
