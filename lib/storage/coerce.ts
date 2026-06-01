/**
 * Tiny, dependency-free coercion helpers for hardening localStorage reads.
 *
 * Stored JSON is UNTRUSTED: it may come from an older app version, have been
 * hand-edited, or gone partially corrupt. The old pattern — casting
 * `JSON.parse(...)` straight to a typed array after only an `Array.isArray`
 * check — means one malformed record can make a page throw the moment it
 * iterates a field that isn't the shape TypeScript was promised
 * (e.g. `for (const it of a.items)` when `items` is missing). With no error
 * boundary above it, that throw surfaces as a dead/blank screen and a top-nav
 * click that "does nothing".
 *
 * These helpers let each store validate-and-normalize on read so consumers
 * always receive well-shaped data. They never throw and they preserve verbatim
 * text wherever it's valid — the product promise is "nothing is rewritten", so
 * normalization only repairs SHAPE (arrays stay arrays, scalars stay scalars),
 * it never edits a user's question or answer text.
 */

/** A plain, non-null object (excludes arrays). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `v` when it's a string, else `fallback`. */
export function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** `v` when it's a string, else `null` — for fields typed `string | null`. */
export function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** `v` when it's a finite number, else `fallback`. Rejects NaN, ±Infinity, and
 *  numeric strings — a count/score must be a real number to be summed safely. */
export function asFiniteNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** `v` when it's a finite number, else `null` — for fields typed `number | null`. */
export function asNullableNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Only a real boolean `true` is true; everything else is false. */
export function asBool(v: unknown): boolean {
  return v === true;
}

/** `v` when it's already an array, else an empty array — so the result is always
 *  safe to `.map()` / `for…of` / read `.length` on, never throwing. */
export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** `v` when it's one of `allowed`, else `fallback` — keeps string-union fields
 *  (modes, types) inside their declared set even if storage holds something stale. */
export function asEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

/** Keep only the string members of an unknown value treated as an array. */
export function asStringArray(v: unknown): string[] {
  return asArray(v).filter((x): x is string => typeof x === "string");
}
