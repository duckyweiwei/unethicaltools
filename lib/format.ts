export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  const digits = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function estimateEta(
  startedAt: number,
  ratio: number,
  now: number = Date.now(),
): number | null {
  if (ratio <= 0.001) return null;
  if (ratio >= 1) return 0;
  const elapsed = now - startedAt;
  const total = elapsed / ratio;
  return Math.max(0, total - elapsed);
}

export function sanitizeBaseName(name: string): string {
  const noExt = name.replace(/\.[^.]+$/, "");
  return noExt.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "video";
}

/**
 * Tailor an estimated conversion time string to the actual file size.
 *
 * Remux time is bounded by I/O (~constant regardless of size), so we always
 * report the per-format "typical" range. Encode time scales roughly linearly
 * with size, so we scale by `bytes / 1 GB`.
 *
 * Returns `null` when we can't form a useful estimate (no size known, etc.).
 */
export function estimateConversionTime(
  bytes: number,
  perGB: { min: number; max: number; unit: "s" | "min" },
): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const gb = bytes / 1024 ** 3;
  const lo = perGB.min * gb;
  const hi = perGB.max * gb;
  return formatRange(lo, hi, perGB.unit);
}

function formatRange(lo: number, hi: number, unit: "s" | "min"): string {
  // Normalize: if the high end of a "seconds" range exceeds 90 s, promote to
  // minutes. If a "minutes" range exceeds 90 min, promote to hours.
  if (unit === "s") {
    if (hi <= 90) return `~${Math.max(1, Math.round(lo))}–${Math.round(hi)} s`;
    return formatRange(lo / 60, hi / 60, "min");
  }
  if (hi <= 90) {
    return `~${roundMin(lo)}–${roundMin(hi)} min`;
  }
  return `~${(lo / 60).toFixed(1)}–${(hi / 60).toFixed(1)} hr`;
}

function roundMin(n: number): string {
  if (n < 1) return "< 1";
  if (n < 10) return n.toFixed(0);
  return `${Math.round(n)}`;
}
