import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `npx neonctl env pull` to populate .env.local.");
}

/**
 * Neon serverless SQL client (HTTP driver).
 *
 * Use as a tagged template for parameterized queries:
 *   const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
 *
 * The tagged-template form escapes interpolated values, so it is safe against
 * SQL injection. Do NOT build query strings by concatenation.
 */
export const sql = neon(process.env.DATABASE_URL);
