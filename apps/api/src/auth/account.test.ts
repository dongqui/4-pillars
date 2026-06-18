import { beforeEach, describe, expect, it } from "vitest";
import type { AuthRepo } from "./account.js";
import { resolveUser } from "./account.js";
import type { NormalizedProfile, ProviderName } from "./types.js";

// 간단한 in-memory fake repo
function makeFakeRepo() {
  const users = new Map<string, { id: string; email: string | null; name: string | null; locale: string | null }>();
  const identities: { provider: ProviderName; providerUserId: string; userId: string }[] = [];
  let seq = 0;
  const repo: AuthRepo = {
    async findIdentity(provider, providerUserId) {
      const found = identities.find((i) => i.provider === provider && i.providerUserId === providerUserId);
      return found ? { userId: found.userId } : null;
    },
    async findUserByEmail(email) {
      for (const u of users.values()) if (u.email === email) return { id: u.id };
      return null;
    },
    async createUser(input) {
      const id = `u${++seq}`;
      users.set(id, { id, ...input });
      return { id };
    },
    async createIdentity(input) {
      identities.push({ provider: input.provider, providerUserId: input.providerUserId, userId: input.userId });
    },
    async getUserById(id) {
      return users.get(id) ?? null;
    },
  };
  return { repo, users, identities };
}

const profile = (over: Partial<NormalizedProfile> = {}): NormalizedProfile => ({
  providerUserId: "p123",
  email: "a@example.com",
  emailVerified: true,
  name: "Alice",
  raw: {},
  ...over,
});

describe("resolveUser", () => {
  let fake: ReturnType<typeof makeFakeRepo>;
  beforeEach(() => {
    fake = makeFakeRepo();
  });

  it("기존 identity가 있으면 그 유저로 로그인한다", async () => {
    const u = await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    await fake.repo.createIdentity({ userId: u.id, provider: "google", providerUserId: "p123", email: "a@example.com", emailVerified: true, rawProfile: {} });
    const res = await resolveUser(fake.repo, { provider: "google", profile: profile(), locale: "ko" });
    expect(res).toEqual({ userId: u.id, created: false });
  });

  it("검증된 이메일이 같으면 기존 유저에 identity를 연결한다", async () => {
    const u = await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    const res = await resolveUser(fake.repo, { provider: "kakao", profile: profile(), locale: "ko" });
    expect(res).toEqual({ userId: u.id, created: false });
    expect(fake.identities).toHaveLength(1);
  });

  it("이메일이 미검증이면 자동 연결하지 않고 새 유저를 만든다", async () => {
    await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    const res = await resolveUser(fake.repo, { provider: "kakao", profile: profile({ emailVerified: false }), locale: "ko" });
    expect(res.created).toBe(true);
    expect(fake.users.size).toBe(2);
  });

  it("이메일이 없으면 새 유저를 만든다", async () => {
    const res = await resolveUser(fake.repo, { provider: "line", profile: profile({ email: null, emailVerified: false }), locale: "ja" });
    expect(res.created).toBe(true);
    expect(fake.users.size).toBe(1);
  });
});
