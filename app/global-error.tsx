"use client";

/**
 * Last-resort boundary for errors thrown in the ROOT layout itself. Next renders
 * it in place of the entire document, so it must supply its own <html>/<body>
 * and can't assume the app's providers — or even the Tailwind pipeline — are
 * intact. Hence plain inline styles. In practice app/error.tsx handles ordinary
 * page errors; this only fires if the shell/layout breaks.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#fff",
          color: "#171717",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#525252",
            }}
          >
            The app hit an unexpected error. Your saved quizzes and progress live
            on this device and aren&apos;t affected.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 8,
              background: "#171717",
              color: "#fff",
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
