import { describe, expect, it } from "vitest";
import { handleCreateFlow } from "./handler";

const birth = {
  year: 1990, month: 6, day: 15, hour: 10, minute: 30, gender: "male", calendar: "solar",
} as const;
const now = new Date("2026-06-01T00:00:00Z");

const deps = {
  userId: "3",
  now,
  checkAccess: async () => ({ ok: true }) as const,
  getProfile: async () => ({ id: "11", birth }),
  findOrCreate: async () => ({ id: "7", created: true }),
};

describe("handleCreateFlow", () => {
  it("본문이 모양에 안 맞으면 400", async () => {
    expect((await handleCreateFlow({}, deps)).status).toBe(400);
  });

  it("비로그인은 401", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      userId: null,
      checkAccess: async () => ({ ok: false, reason: "unauthenticated" }) as const,
    });
    expect(out.status).toBe(401);
  });

  it("한도에 걸리면 429", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      checkAccess: async () => ({ ok: false, reason: "rate_limited" }) as const,
    });
    expect(out.status).toBe(429);
  });

  it("잔액이 모자라면 402 — 한도와 다른 코드다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      checkAccess: async () => ({ ok: false, reason: "insufficient_tickets" }) as const,
    });
    expect(out.status).toBe(402);
  });

  it("남의 프로필이면 404 — getProfile 이 userId 로 거른다", async () => {
    const out = await handleCreateFlow({ profileId: "99" }, {
      ...deps,
      getProfile: async () => null,
    });
    expect(out.status).toBe(404);
  });

  it("만들면 201 과 id 를 준다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, deps);
    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({ id: "7" });
  });

  it("이미 있으면 200 — 같은 행으로 수렴한다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      findOrCreate: async () => ({ id: "7", created: false }),
    });
    expect(out.status).toBe(200);
  });

  it("명리 연도와 구간을 계산해 넘긴다 — 행에 박제될 값이다", async () => {
    let got: { flowYear: number; segments: unknown[] } | null = null;
    await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      findOrCreate: async (_u, input) => {
        got = input as never;
        return { id: "7", created: true };
      },
    });
    expect(got!.flowYear).toBe(2026);
    expect(got!.segments.length).toBeGreaterThanOrEqual(1);
    expect(got!.segments.length).toBeLessThanOrEqual(3);
  });
});
