/**
 * Markdown report of every range the bleep tool muted. Pairs with the
 * exported MP4 so the user has a record of what was changed and where.
 */
import type { BleepRange } from "./types";

export interface MuteLogOptions {
  sourceName: string;
  ranges: readonly BleepRange[];
  /** Total audio duration in seconds — used to compute the % muted line. */
  audioDurationSec?: number;
  /** Pad applied during the mute pass — surfaced so the user knows the
   *  reported start/end may be ~2x pad wider than what they reviewed. */
  padSec?: number;
}

export function buildMuteLog(opts: MuteLogOptions): string {
  const sorted = [...opts.ranges].sort((a, b) => a.startSec - b.startSec);
  const totalSec = sorted.reduce(
    (acc, r) => acc + Math.max(0, r.endSec - r.startSec),
    0,
  );

  const lines: string[] = [];
  lines.push(`# Bleeps in ${opts.sourceName}`);
  lines.push("");
  lines.push(
    `${sorted.length} range${sorted.length === 1 ? "" : "s"} muted, total ${totalSec.toFixed(2)}s.`,
  );
  if (opts.audioDurationSec && opts.audioDurationSec > 0) {
    const pct = (totalSec / opts.audioDurationSec) * 100;
    lines.push(`That's ${pct.toFixed(1)}% of the ${opts.audioDurationSec.toFixed(1)}s audio track.`);
  }
  if (opts.padSec && opts.padSec > 0) {
    lines.push(
      `Each range was padded by ${(opts.padSec * 1000).toFixed(0)} ms on both sides, and extended to at least a character-count-based minimum so held / sustained swears don't leak out the end.`,
    );
  }
  lines.push("");
  lines.push("| # | Word | Start | End | Duration | Source |");
  lines.push("|---|------|-------|-----|----------|--------|");
  sorted.forEach((r, i) => {
    const dur = Math.max(0, r.endSec - r.startSec);
    lines.push(
      `| ${i + 1} | \`${escapeCell(r.text)}\` | ${formatTimecode(r.startSec)} | ${formatTimecode(r.endSec)} | ${dur.toFixed(2)}s | ${r.source} |`,
    );
  });
  return lines.join("\n") + "\n";
}

function formatTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function escapeCell(text: string): string {
  // Pipes break table cells; backticks already protect most other chars.
  return text.replace(/\|/g, "\\|");
}
