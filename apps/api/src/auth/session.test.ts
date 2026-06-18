import { describe, expect, it } from "vitest";
import type { SessionRepo } from "./session.js";
import { endSession, getSessionUser, issueSession } from "./session.js";

function makeFakeRepo() {
  const rows = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  const repo: SessionRepo = {
    async createSession({ token, userId, expiresAt }) {
      rows.set(token, { userId, expiresAt, revokedAt: null });
    },
    async findSession(token) {
      return rows.get(token) ?? null;
    },
    async revokeSession(token, revokedAt) {
      const r = rows.get(token);
      if (r) r.revokedAt = revokedAt;
    },
  };
  return { repo, rows };
}

describe("session", () => {
  it("issueSession은 토큰을 만들고 저장한다", async () => {
    const { repo, rows } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token, expiresAt } = await issueSession(repo, "u1", now);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    expect(rows.get(token)?.userId).toBe("u1");
  });

  it("유효 세션은 userId를 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token } = await issueSession(repo, "u1", now);
    expect(await getSessionUser(repo, token, now)).toEqual({ userId: "u1" });
  });

  it("만료된 세션은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token, expiresAt } = await issueSession(repo, "u1", now);
    const later = new Date(expiresAt.getTime() + 1000);
    expect(await getSessionUser(repo, token, later)).toBeNull();
  });

  it("철회된 세션은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token } = await issueSession(repo, "u1", now);
    await endSession(repo, token, now);
    expect(await getSessionUser(repo, token, now)).toBeNull();
  });

  it("없는 토큰은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    expect(await getSessionUser(repo, "nope")).toBeNull();
  });
});
