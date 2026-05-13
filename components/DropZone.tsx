"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { detectFormatFromFile, type FormatConfig } from "@/lib/formats";

export interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Page's expected input format — drives the accept= filter + copy. */
  inputFormat: FormatConfig;
  /**
   * Generic mode: present as a universal "drop any video" converter rather
   * than a format-specific one. Used by the desktop app where format
   * detection happens automatically and there's no SEO landing context.
   */
  genericMode?: boolean;
}

export function DropZone({
  onFile,
  disabled,
  inputFormat,
  genericMode = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const acceptAttr = useMemo(() => {
    const exts = inputFormat.extensions.map((e) => `.${e}`).join(",");
    const mimes = inputFormat.mimeTypes.join(",");
    // Always include video/* so users can drop adjacent formats — we'll detect
    // and route them through the right pipeline. The first portion is the hint
    // shown by the file picker for this format specifically.
    return `${exts},${mimes},video/*`;
  }, [inputFormat]);

  const extLabel = inputFormat.extensions.map((e) => `.${e}`).join(", ");

  const handleFiles = useCallback(
    (files: FileList | null) => {
      setWarning(null);
      const file = files?.[0];
      if (!file) return;
      const detected = detectFormatFromFile(file);
      if (!detected) {
        setWarning(
          `That doesn't look like a recognized video format. Continuing — ffmpeg will reject it if unsupported.`,
        );
      } else if (!genericMode && detected.id !== inputFormat.id) {
        // In format-specific mode (web routes), inform the user we're routing
        // their drop through a different pipeline than the page name suggests.
        // In genericMode (desktop app) there's no page format to mismatch.
        setWarning(
          `Detected a .${detected.extensions[0]} file (${detected.displayName}). Converting using the ${detected.displayName} pipeline.`,
        );
      }
      onFile(file);
    },
    [inputFormat, onFile, genericMode],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      setIsOver(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback(() => setIsOver(false), []);

  return (
    <div
      className={[
        "relative rounded-3xl glass p-10 sm:p-14 text-center transition-all duration-200",
        isOver
          ? "ring-accent border-[var(--color-accent)] scale-[1.005]"
          : "hover:border-[var(--color-border-strong)]",
        disabled ? "opacity-60 pointer-events-none" : "cursor-pointer",
      ].join(" ")}
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      aria-label={
        genericMode
          ? "Select or drop a video file"
          : `Select or drop a ${inputFormat.displayName} file`
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl glass-strong mb-6">
        <UploadCloudIcon />
      </div>

      <h3 className="text-xl sm:text-2xl font-medium tracking-tight">
        {isOver
          ? "Drop it here"
          : genericMode
            ? "Drop a video file or click to browse"
            : `Drop a ${inputFormat.displayName} file or click to browse`}
      </h3>
      {genericMode ? (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Supports{" "}
          <code className="font-mono">.ts</code>,{" "}
          <code className="font-mono">.mov</code>,{" "}
          <code className="font-mono">.mkv</code>,{" "}
          <code className="font-mono">.webm</code>,{" "}
          <code className="font-mono">.avi</code>,{" "}
          <code className="font-mono">.flv</code>,{" "}
          <code className="font-mono">.mpeg</code>
          {" "}— format auto-detected.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Supports{" "}
            {inputFormat.extensions.map((e, i, arr) => (
              <span key={e}>
                <code className="font-mono">.{e}</code>
                {i < arr.length - 1 ? ", " : ""}
              </span>
            ))}{" "}
            — processed entirely on this device.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-dim)]">
            Or drop any other supported video format: we'll detect it.
          </p>
        </>
      )}

      {warning && (
        <p className="mt-4 text-xs text-amber-300/90">{warning}</p>
      )}

      {/* keep extLabel in scope for callers that introspect; visible in copy above */}
      <span className="sr-only">{extLabel}</span>
    </div>
  );
}

function UploadCloudIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-text)]"
    >
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <path d="M16 16l-4-4-4 4" />
    </svg>
  );
}
