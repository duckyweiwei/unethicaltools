"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LogLine, Stage } from "@/lib/types";
import { formatDuration } from "@/lib/format";

const STAGE_LABELS: Record<Stage, string> = {
  idle: "Idle",
  "loading-engine": "Loading engine",
  "reading-file": "Reading file",
  remuxing: "Remuxing (fast path)",
  encoding: "Re-encoding (fallback)",
  "writing-output": "Finalizing",
  done: "Done",
  error: "Error",
};

export function ProgressView({
  stage,
  ratio,
  etaMs,
  elapsedMs,
  logs,
  mode,
}: {
  stage: Stage;
  ratio: number;
  etaMs: number | null;
  elapsedMs: number;
  logs: LogLine[];
  mode: "remux" | "encode" | null;
}) {
  const visibleLogs = useMemo(() => logs.slice(-80), [logs]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLogs.length]);

  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
            {mode === "encode" ? "Re-encoding" : "Converting"}
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {STAGE_LABELS[stage]}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono tabular-nums text-[var(--color-text)]">
            {pct}%
          </div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">
            {etaMs == null
              ? `${formatDuration(elapsedMs)} elapsed`
              : `${formatDuration(etaMs)} left`}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="mt-5 relative h-2.5 w-full rounded-full overflow-hidden bg-white/[0.04] border border-[var(--color-border)]">
        <div
          className="absolute inset-y-0 left-0 accent-gradient-bg transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-0 shimmer opacity-40"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stage steps */}
      <Steps stage={stage} mode={mode} />

      {/* Logs */}
      <details className="mt-6 group" open>
        <summary className="flex items-center justify-between cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          <span className="flex items-center gap-2">
            <ChevronIcon />
            Processing log
          </span>
          <span className="text-xs font-mono text-[var(--color-text-dim)]">
            {visibleLogs.length} lines
          </span>
        </summary>
        <div
          ref={logRef}
          className="mt-3 max-h-56 overflow-y-auto scrollbar-thin rounded-xl border border-[var(--color-border)] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-[var(--color-text-muted)]"
        >
          {visibleLogs.length === 0 ? (
            <div className="text-[var(--color-text-dim)]">No log output yet…</div>
          ) : (
            visibleLogs.map((l, i) => (
              <div key={i} className={logColor(l.level)}>
                <span className="text-[var(--color-text-dim)] mr-2">
                  [{l.level}]
                </span>
                {l.message}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

function Steps({ stage, mode }: { stage: Stage; mode: "remux" | "encode" | null }) {
  const order: Stage[] = [
    "loading-engine",
    "reading-file",
    mode === "encode" ? "encoding" : "remuxing",
    "writing-output",
  ];
  const currentIdx = order.indexOf(stage);
  return (
    <ol className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {order.map((s, i) => {
        const done = currentIdx > i || stage === "done";
        const active = i === currentIdx && stage !== "done";
        return (
          <li
            key={s}
            className={[
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs border transition-colors",
              done
                ? "border-emerald-400/30 text-emerald-300 bg-emerald-400/[0.04]"
                : active
                  ? "border-[var(--color-accent)]/40 text-[var(--color-text)] bg-white/[0.03]"
                  : "border-[var(--color-border)] text-[var(--color-text-dim)]",
            ].join(" ")}
          >
            <span
              className={[
                "h-1.5 w-1.5 rounded-full",
                done
                  ? "bg-emerald-400"
                  : active
                    ? "bg-[var(--color-accent)] animate-pulse"
                    : "bg-white/15",
              ].join(" ")}
            />
            {STAGE_LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}

function logColor(level: LogLine["level"]) {
  switch (level) {
    case "error":
      return "text-rose-300";
    case "warn":
      return "text-amber-300";
    case "info":
      return "text-cyan-300";
    case "ffmpeg":
      return "text-[var(--color-text-muted)]";
  }
}

function ChevronIcon() {
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
      className="transition-transform group-open:rotate-90"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
