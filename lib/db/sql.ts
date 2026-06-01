/**
 * The one and only database handle. We use Neon's serverless driver over HTTP:
 * each query is a stateless fetch, so there's no pool to manage and it works the
 * same in a Vercel serverless function as it does in a one-off script.
 *
 * GRACEFUL DEGRADATION: importing this module never throws. If `DATABASE_URL`
 * isn't set, `hasDb()` returns false and callers fall back to "signed-out / not
 * Pro" — the app keeps working with no database, exactly like billing degrades to
 * 503 when Stripe isn't configured. Only `getSql()` throws, and only when a
 * caller actually needs the DB while it's unconfigured.
 *
 * WHAT LIVES HERE: identity-keyed entitlement only (who is Pro). Quiz content
 * never touches this database — it stays in the browser's localStorage/IndexedDB,
 * same as it always has. The promise that "we host nothing of your content" holds.
 */
import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let cached: SqlClient | null = null;

/** True when a database connection string is configured. */
export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** The shared Neon query function. Throws only if called while unconfigured. */
export function getSql(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — the database isn’t configured.");
  }
  if (!cached) cached = neon(url);
  return cached;
}
