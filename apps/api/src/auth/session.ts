import { randomToken } from "./pkce.js";

export interface SessionRepo {
  createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>;
  findSession(token: string): Promise<{ userId: string; expiresAt: Date; revokedAt: Date | null } | null>;
  revokeSession(token: string, revokedAt: Date): Promise<void>;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueSession(
  repo: SessionRepo,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(48);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await repo.createSession({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(
  repo: SessionRepo,
  token: string,
  now: Date = new Date(),
): Promise<{ userId: string } | null> {
  const row = await repo.findSession(token);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  return { userId: row.userId };
}

export async function endSession(
  repo: SessionRepo,
  token: string,
  now: Date = new Date(),
): Promise<void> {
  await repo.revokeSession(token, now);
}
