"use client";

/**
 * Route-segment error boundary — the site-wide safety net for client render.
 *
 * Before this file existed the app had NO error boundary, so any uncaught throw
 * during a client render (most often a page choking on an old or partially
 * corrupt localStorage record) unwound to a blank screen with no way back. A
 * top-nav click that happened to land on the throwing page therefore looked like
 * it "did nothing". This boundary catches those throws anywhere under app/ and
 * shows a calm, on-brand, recoverable message instead of a dead screen.
 *
 * `reset()` re-renders the segment (worth a shot for transient errors); the home
 * link is the guaranteed escape hatch.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the real error visible in the console for debugging — the user only
    // ever sees the friendly card below.
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide text-neutral-400">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          This page hit an unexpected error
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Your saved quizzes and progress are stored on this device and
          aren&apos;t affected. Try again, or head back home.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Go home
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-neutral-400">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
