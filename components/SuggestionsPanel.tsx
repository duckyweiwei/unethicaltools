"use client";

import { useState } from "react";
import { SuggestionsForm } from "./SuggestionsForm";

type Mode = "idea" | "issue";

/**
 * Page-level wrapper with two clear entry points above the form:
 *   - "Got an idea?"   → opens the form with the format-request category
 *   - "Hit a problem?" → opens the form pre-set to the issue category and
 *                        scrolls the user straight to it.
 *
 * Both lead to the same SuggestionsForm — the mode just changes which
 * category radio is pre-selected. The form re-mounts on mode change so the
 * defaultCategory takes effect immediately.
 */
export function SuggestionsPanel() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode === null) {
    return (
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setMode("idea")}
          className="group rounded-2xl glass p-5 sm:p-6 text-left transition-colors hover:border-[var(--color-border-strong)] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-400/10 border border-violet-400/30 text-violet-300">
              <SparkleIcon />
            </span>
            <span className="text-base font-medium tracking-tight text-[var(--color-text)]">
              Got an idea?
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Suggest a new format (WMV, VOB, audio, etc.), a feature like batch
            conversion or trimming, or anything else you'd like to see.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
            Share an idea
            <ArrowRight />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("issue")}
          className="group rounded-2xl glass p-5 sm:p-6 text-left transition-colors hover:border-[var(--color-border-strong)] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-400/10 border border-amber-400/30 text-amber-300">
              <WarnIcon />
            </span>
            <span className="text-base font-medium tracking-tight text-[var(--color-text)]">
              Hit a problem?
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            A bug, a crash, output that won't play, a conversion that stalled —
            tell us what happened and how to reproduce it.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
            Report an issue
            <ArrowRight />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode(null)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <ArrowLeft />
        Back to options
      </button>
      <SuggestionsForm defaultCategory={mode === "issue" ? "bug" : "format"} />
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
