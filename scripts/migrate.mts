import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL(_UNPOOLED)가 설정되지 않았습니다. `--env-file=.env.local`로 실행하세요.");
}
const sql = neon(url);

const dir = join(process.cwd(), "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const text = await readFile(join(dir, file), "utf8");
  console.log(`applying ${file}`);
  await sql.query(text);
}
console.log(`done (${files.length} migration(s))`);
