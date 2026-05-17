"use client";

import { useEffect, useState } from "react";
import {
  getStoredModelChoice,
  setStoredModelChoice,
  MODEL_INFO,
  type WhisperModelChoice,
} from "@/lib/bleep/model-pref";

/**
 * Compact two-option segmented control above the dropzone. Hydrates from
 * localStorage on mount (SSR safe — initial render uses the default so
 * markup matches), then surfaces the persisted choice. Switching while a
 * pipeline is loaded for the other model triggers a one-time reload at
 * the next transcription (whisper.ts caches per model id).
 */
export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: WhisperModelChoice;
  onChange: (next: WhisperModelChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-auto mb-4 flex max-w-fit items-center gap-2 rounded-full glass p-1 text-[11px] font-mono">
      <span className="px-2 text-[var(--color-text-dim)]">Model</span>
      {(Object.keys(MODEL_INFO) as WhisperModelChoice[]).map((choice) => {
        const info = MODEL_INFO[choice];
        const active = choice === value;
        return (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            disabled={disabled}
            title={`${info.label} · ${info.sizeLabel} · ${info.speedLabel} · ${info.hint}`}
            className={[
              "px-2.5 py-1 rounded-full transition-colors whitespace-nowrap",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              active
                ? "bg-white/[0.08] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            ].join(" ")}
          >
            {info.label}
            <span className="ml-1 opacity-60">{info.speedLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Convenience hook: persistent model choice. Returns the current value and
 * a setter that also writes through to localStorage. Hydrates on mount to
 * avoid SSR/CSR mismatch.
 */
export function useModelChoice(): [WhisperModelChoice, (c: WhisperModelChoice) => void] {
  const [choice, setChoice] = useState<WhisperModelChoice>("base");

  useEffect(() => {
    setChoice(getStoredModelChoice());
  }, []);

  const update = (next: WhisperModelChoice) => {
    setChoice(next);
    setStoredModelChoice(next);
  };

  return [choice, update];
}
