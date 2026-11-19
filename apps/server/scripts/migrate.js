import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabaseConnection, closeDatabase, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to run migrations.");
  process.exit(1);
}

const migrationsDir = path.resolve(__dirname, "../../../db/migrations");

const ensureMigrationsTable = async () => {
  await query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
};

const run = async () => {
  const check = await checkDatabaseConnection();
  if (!check.ok) {
    throw new Error(`Database connection failed: ${check.reason}`);
  }

  await ensureMigrationsTable();

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.log("No migration files found.");
    return;
  }

  for (const file of files) {
    const already = await query(
      "select 1 from public.schema_migrations where filename = $1 limit 1",
      [file],
    );
    if (already.rows.length) {
      console.log(`  - ${file} (already applied)`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`  • applying ${file}`);
    await query("begin");
    try {
      await query(sql);
      await query(
        "insert into public.schema_migrations (filename) values ($1)",
        [file],
      );
      await query("commit");
      console.log(`  ✓ ${file}`);
    } catch (error) {
      await query("rollback");
      throw error;
    }
  }

  console.log("Migrations complete.");
};

run()
  .catch((error) => {
    console.error("[migrate] Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });