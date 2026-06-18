import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let db: PostgresJsDatabase<typeof schema> | undefined;

/** 지연 초기화된 Drizzle 클라이언트 싱글턴. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return db;
}
