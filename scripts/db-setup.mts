/**
 * Apply lib/db/schema.sql to the database in DATABASE_URL. Idempotent — every
 * statement is CREATE … IF NOT EXISTS — so it's safe to run on a fresh database
 * or an existing one. Run with:  npm run db:setup
 *
 * Standalone scripts don't get Next.js's .env loading, so we read .env.local
 * ourselves (without printing any secret).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Minimal .env loader: KEY=value lines, '#' comments, optional quotes. Only
 *  fills vars that aren't already in the environment. */
function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return;
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

/** Split a .sql file into individual statements, dropping `--` comments. */
function statements(sql: string): string[] {
  const noComments = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error("✖ DATABASE_URL is not set (looked in environment and .env.local).");
    process.exit(1);
  }

  // Imported after env is loaded so the client picks up DATABASE_URL.
  const { getSql } = await import("../lib/db/sql.ts");
  const sql = getSql();

  const schemaPath = resolve(process.cwd(), "lib/db/schema.sql");
  const stmts = statements(readFileSync(schemaPath, "utf8"));

  console.log(`Applying ${stmts.length} statement(s) from lib/db/schema.sql …`);
  for (const stmt of stmts) {
    await sql.query(stmt);
    console.log("  ✓ " + stmt.split("\n")[0].slice(0, 60));
  }

  const rows = (await sql.query(
    "select count(*)::int as n from entitlements",
  )) as Array<{ n: number }>;
  console.log(`✔ Done. entitlements table is present (${rows[0].n} row(s)).`);
}

main().catch((err) => {
  console.error("✖ db:setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
