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
  // 파일 전체를 한 번의 prepared statement 로 보낸다 — Neon HTTP 드라이버는 한 쿼리에
  // 문장을 여러 개 담는 걸 거부한다. 그래서 마이그레이션 파일 하나에 SQL 문장은 하나만 담는다.
  await sql.query(text);
  await sql.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  applied.add(file);
  appliedCount++;
}
console.log(`done (${appliedCount} applied, ${skippedCount} skipped)`);
