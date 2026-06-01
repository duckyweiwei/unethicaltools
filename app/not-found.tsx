/**
 * 404 page — shown for unknown routes and any `notFound()` call. Matches the
 * site's minimalist look and always offers a way back, so a mistyped or stale
 * link is a soft landing rather than a dead end.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide text-neutral-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          The link may be broken, or the page may have moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Go home
          </Link>
          <Link
            href="/library"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            My quizzes
          </Link>
        </div>
      </div>
    </main>
  );
}
