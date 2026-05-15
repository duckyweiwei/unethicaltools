"use client";

import { useEffect, useState } from "react";
import { estimateMaxFileSizeBytes, getDeviceMemoryGB } from "@/lib/memory";
import { formatBytes } from "@/lib/format";
import { isDesktop } from "@/lib/desktop-bridge";

/**
 * Compact one-line stat for the FormatHero, sized off the user's actual
 * device. Hidden in the Tauri desktop app — there's no memory limit there.
 *
 * Renders nothing until after mount so the SSR'd HTML doesn't include a
 * device-specific value (would cause hydration mismatch + leak the user's
 * device hint into our static cache).
 */
export function DeviceMemoryStat() {
  const [estimate, setEstimate] = useState<number | null>(null);
  const [deviceGB, setDeviceGB] = useState<number | null>(null);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    if (isDesktop()) {
      // Native ffmpeg has no browser ceiling — don't show this stat in the app.
      setHide(true);
      return;
    }
    setEstimate(estimateMaxFileSizeBytes());
    setDeviceGB(getDeviceMemoryGB());
  }, []);

  if (hide || estimate === null) return null;

  return (
    <div
      className="mt-2 inline-flex items-center gap-2 text-xs font-mono text-[var(--color-text-dim)] fade-in"
      title={
        deviceGB
          ? `Heuristic from your browser's reported ${deviceGB} GB of system RAM. Actual headroom depends on what other tabs and apps are using right now.`
          : `Conservative default — your browser doesn't expose RAM info, so we assume entry-level.`
      }
    >
      <CpuIcon />
      <span>
        Your browser can handle:{" "}
        <span className="text-[var(--color-text-muted)]">
          up to ~{formatBytes(estimate)}
        </span>
        {deviceGB ? ` on this device (${deviceGB} GB RAM)` : ""}
      </span>
    </div>
  );
}

function CpuIcon() {
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
      className="opacity-60"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="15" x2="4" y2="15" />
    </svg>
  );
}
