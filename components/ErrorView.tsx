"use client";

export function ErrorView({
  message,
  onReset,
  onRetry,
}: {
  message: string;
  onReset: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="glass rounded-3xl p-6 sm:p-8 border-rose-400/20 fade-in">
      <div className="flex items-start gap-5">
        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-400/10 border border-rose-400/30">
          <WarnIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-rose-300/90 font-mono">
            Something went wrong
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            Conversion failed
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] break-words">
            {message}
          </p>
          <p className="mt-3 text-xs text-[var(--color-text-dim)]">
            This usually happens when the file uses an unusual codec, is
            truncated, or your browser is low on memory. Try a different file or
            reload the page.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Start over
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-rose-300"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
