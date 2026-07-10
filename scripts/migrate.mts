import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL(_UNPOOLED)가 설정되지 않았습니다. `--env-file=.env.local`로 실행하세요.");
}
const sql = neon(url);

// 적용된 마이그레이션 추적
await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`);
const appliedRows = await sql.query("SELECT filename FROM schema_migrations");
const applied = new Set(appliedRows.map((r) => r.filename as string));

const dir = join(process.cwd(), "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

let appliedCount = 0;
let skippedCount = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip ${file} (already applied)`);
    skippedCount++;
    continue;
  }
  const text = await readFile(join(dir, file), "utf8");
  console.log(`applying ${file}`);
  await sql.query(text);
  await sql.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  applied.add(file);
  appliedCount++;
}
console.log(`done (${appliedCount} applied, ${skippedCount} skipped)`);
