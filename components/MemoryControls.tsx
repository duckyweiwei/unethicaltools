"use client";

import { useCallback, useEffect, useState } from "react";
import { disposeWhisper, isWhisperLoaded } from "@/lib/bleep/whisper";
import { getConverter } from "@/lib/converter-client";

/**
 * Inline footer below the dropzone explaining what holds memory and
 * giving the user an explicit "release" button. After multiple
 * transcriptions on a long file, ffmpeg.wasm + the loaded Whisper model
 * + the WebGPU session can sit on hundreds of MB of heap + GPU memory.
 * Click → terminate the Whisper worker (frees ONNX + WebGPU) and dispose
 * the ffmpeg engine (frees WASM heap).
 *
 * The model files stay in the browser HTTP cache, so the next run still
 * gets the "Loaded from cache" fast path (~3 s) instead of a fresh
 * ~80 MB download.
 */
export function MemoryControls({ visible = true }: { visible?: boolean }) {
  const [whisperLoaded, setWhisperLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const [justReleased, setJustReleased] = useState(false);

  // Poll for load state — the modules don't expose change events, so this
  // is the simplest accurate signal. Cheap (boolean check on a singleton).
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setWhisperLoaded(isWhisperLoaded());
      setEngineLoaded(getConverter().isLoaded());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const handleRelease = useCallback(() => {
    const disposedWhisper = disposeWhisper();
    const client = getConverter();
    const wasEngineLoaded = client.isLoaded();
    if (wasEngineLoaded) client.dispose();
    setWhisperLoaded(false);
    setEngineLoaded(false);
    if (disposedWhisper || wasEngineLoaded) {
      setJustReleased(true);
      window.setTimeout(() => setJustReleased(false), 2500);
    }
  }, []);

  if (!visible) return null;
  const anythingLoaded = whisperLoaded || engineLoaded;

  return (
    <div className="mx-auto mt-4 max-w-2xl px-4 sm:px-6">
      <details className="group rounded-2xl border border-[var(--color-border)] bg-white/[0.02] text-[11px] font-mono">
        <summary className="cursor-pointer px-3 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center justify-between gap-3">
          <span>
            Memory:{" "}
            {anythingLoaded ? (
              <span className="text-[var(--color-text)]">
                {[engineLoaded && "ffmpeg.wasm", whisperLoaded && "Whisper"]
                  .filter(Boolean)
                  .join(" + ")}{" "}
                loaded
              </span>
            ) : (
              <span className="opacity-70">nothing loaded</span>
            )}
          </span>
          <span className="opacity-70 group-open:hidden">show details</span>
          <span className="opacity-70 hidden group-open:inline">hide</span>
        </summary>
        <div className="px-3 pb-3 pt-1 text-[var(--color-text-dim)] leading-relaxed space-y-2">
          <p>
            <span className="text-[var(--color-text-muted)]">In memory now:</span>{" "}
            {anythingLoaded
              ? "the ffmpeg.wasm heap (~256 MB) and/or the Whisper ONNX model + WebGPU session (~80–300 MB depending on which size you ran). Both get reused across runs so subsequent jobs are faster."
              : "nothing — neither tool has run yet this session, or you’ve already released."}
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Persisted across sessions:</span>{" "}
            ~1 byte of your model preference in localStorage, plus the Whisper model files in the browser&rsquo;s HTTP cache (~40 MB tiny.en, ~80 MB base.en if both have been used). Clear via Chrome → Settings → Privacy → Clear browsing data if needed.
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Never persisted:</span>{" "}
            any audio you drop, any transcript, any video output. All ephemeral, gone on reload.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleRelease}
              disabled={!anythingLoaded}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Release from memory
            </button>
            {justReleased && (
              <span className="text-emerald-300/90">Released. Next run reloads from cache (~3 s).</span>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
