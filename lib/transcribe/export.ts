/**
 * Exporters for the transcribe tool: plain text, SRT (SubRip), VTT
 * (WebVTT), and JSON with word + cue timestamps.
 *
 * SRT and VTT share the same hh:mm:ss timecode but differ in their
 * fractional separator (`,` for SRT, `.` for VTT) and SRT prepends a
 * numeric cue index while VTT prepends a `WEBVTT` header.
 */
import type { TranscribedWord } from "@/lib/bleep/types";
import type { Cue } from "./cues";

export function toPlainText(cues: readonly Cue[]): string {
  return cues.map((c) => c.text).join(" ").trim() + "\n";
}

export function toSRT(cues: readonly Cue[]): string {
  const lines: string[] = [];
  cues.forEach((c, i) => {
    lines.push(String(i + 1));
    lines.push(`${formatSRT(c.startSec)} --> ${formatSRT(c.endSec)}`);
    lines.push(c.text);
    lines.push("");
  });
  return lines.join("\n");
}

export function toVTT(cues: readonly Cue[]): string {
  const lines: string[] = ["WEBVTT", ""];
  cues.forEach((c) => {
    lines.push(`${formatVTT(c.startSec)} --> ${formatVTT(c.endSec)}`);
    lines.push(c.text);
    lines.push("");
  });
  return lines.join("\n");
}

export interface JSONExportOptions {
  sourceName: string;
  audioDurationSec: number;
  device: "webgpu" | "wasm";
  words: readonly TranscribedWord[];
  cues: readonly Cue[];
}

export function toJSON(opts: JSONExportOptions): string {
  return (
    JSON.stringify(
      {
        source: opts.sourceName,
        audioDurationSec: opts.audioDurationSec,
        device: opts.device,
        wordCount: opts.words.length,
        cueCount: opts.cues.length,
        words: opts.words.map((w) => ({
          text: w.text.trim(),
          start: round3(w.startSec),
          end: round3(w.endSec),
        })),
        cues: opts.cues.map((c) => ({
          start: round3(c.startSec),
          end: round3(c.endSec),
          text: c.text,
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

function formatSRT(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function formatVTT(sec: number): string {
  return formatSRT(sec).replace(",", ".");
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
