// One-off migration runner: applies supabase/migrations/*.sql over a direct
// Postgres connection (SUPABASE_DB_URL). Runtime code never uses this — it talks
// to the Supabase REST API. DDL can't go through PostgREST.
//
// Usage:  node --env-file=.env.local scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set (run with --env-file=.env.local).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase requires TLS; the pooler cert isn't in the local trust store.
  ssl: { rejectUnauthorized: false },
});

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

try {
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    console.log(`applying ${f}…`);
    await client.query(sql);
  }
  console.log(`done — ${files.length} migration(s) applied.`);
} catch (err) {
  console.error("migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
