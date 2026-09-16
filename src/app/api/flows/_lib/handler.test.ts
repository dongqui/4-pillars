import { describe, expect, it } from "vitest";
import { flowYearOf } from "@/lib/saju-core";
import { flowYearRange, handleCreateFlow, type CreateFlowDeps } from "./handler";

const birth = {
  year: 1990, month: 6, day: 15, hour: 10, minute: 30, gender: "male", calendar: "solar",
} as const;
const now = new Date("2026-06-01T00:00:00Z");

const baseDeps: CreateFlowDeps = {
  userId: "3",
  now,
  checkAccess: async () => ({ ok: true }) as const,
  getProfile: async () => ({ id: "11", birth }),
  findOrCreate: async () => ({ id: "7", created: true }),
};

/** overrides 만 바꿔 끼우는 헬퍼 — 아래 "연도" describe 블록도 이걸 그대로 쓴다. */
function deps(overrides: Partial<CreateFlowDeps> = {}): CreateFlowDeps {
  return { ...baseDeps, ...overrides };
}

describe("handleCreateFlow", () => {
  it("본문이 모양에 안 맞으면 400", async () => {
    expect((await handleCreateFlow({}, deps())).status).toBe(400);
  });

  it("비로그인은 401", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      userId: null,
      checkAccess: async () => ({ ok: false, reason: "unauthenticated" }) as const,
    }));
    expect(out.status).toBe(401);
  });

  it("한도에 걸리면 429", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      checkAccess: async () => ({ ok: false, reason: "rate_limited" }) as const,
    }));
    expect(out.status).toBe(429);
  });

  it("잔액이 모자라면 402 — 한도와 다른 코드다", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      checkAccess: async () => ({ ok: false, reason: "insufficient_tickets" }) as const,
    }));
    expect(out.status).toBe(402);
  });

  it("남의 프로필이면 404 — getProfile 이 userId 로 거른다", async () => {
    const out = await handleCreateFlow({ profileId: "99", year: 2026 }, deps({
      getProfile: async () => null,
    }));
    expect(out.status).toBe(404);
  });

  it("만들면 201 과 id 를 준다", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026 }, deps());
    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({ id: "7" });
  });

  it("이미 있으면 200 — 같은 행으로 수렴한다", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      findOrCreate: async () => ({ id: "7", created: false }),
    }));
    expect(out.status).toBe(200);
  });

  it("고른 연도와 12개월을 계산해 넘긴다 — 행에 박제될 값이다", async () => {
    let got: { flowYear: number; months: unknown[] } | null = null;
    await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      findOrCreate: async (_u, input) => {
        got = input as never;
        return { id: "7", created: true };
      },
    }));
    expect(got!.flowYear).toBe(2026);
    expect(got!.months).toHaveLength(12);
  });
});

describe("handleCreateFlow — 연도", () => {
  const NOW = new Date("2026-06-15T00:00:00Z"); // 명리 2026년

  it("고른 해로 행을 만든다", async () => {
    const captured: unknown[] = [];
    const res = await handleCreateFlow(
      { profileId: "3", year: 2029 },
      deps({ now: NOW, findOrCreate: async (_u, input) => { captured.push(input); return { id: "9", created: true }; } }),
    );
    expect(res.status).toBe(201);
    expect((captured[0] as { flowYear: number }).flowYear).toBe(2029);
  });

  it("과거 해도 만든다 — 복기가 이 서비스의 절반이다", async () => {
    const captured: { flowYear: number }[] = [];
    const res = await handleCreateFlow(
      { profileId: "3", year: 2021 },
      deps({ now: NOW, findOrCreate: async (_u, i) => { captured.push(i as never); return { id: "9", created: true }; } }),
    );
    expect(res.status).toBeLessThan(400);
    // status 만 보면 스텁이 그냥 통과시킨 것과 구분이 안 된다 — 실제로 2021년이
    // 박제됐는지까지 본다.
    expect(captured[0].flowYear).toBe(2021);
  });

  it("범위 밖 연도는 400 이다", async () => {
    for (const year of [2020, 2032]) {
      const res = await handleCreateFlow({ profileId: "3", year }, deps({ now: NOW }));
      expect(res.status, String(year)).toBe(400);
    }
  });

  it("연도가 없으면 400 이다 — 지금으로 조용히 물러서지 않는다", async () => {
    // 물러서면 사용자가 2029 를 골랐는데 2026 을 사는 일이 생긴다
    const res = await handleCreateFlow({ profileId: "3" }, deps({ now: NOW }));
    expect(res.status).toBe(400);
  });

  it("period 는 고른 해의 입춘 경계다", async () => {
    const captured: { periodStart: Date; periodEnd: Date }[] = [];
    await handleCreateFlow(
      { profileId: "3", year: 2029 },
      deps({ now: NOW, findOrCreate: async (_u, i) => { captured.push(i); return { id: "9", created: true }; } }),
    );
    expect(captured[0].periodStart.getUTCFullYear()).toBe(2029);
    expect(captured[0].periodEnd.getUTCFullYear()).toBe(2030);
  });

  it("months 12개를 박제한다", async () => {
    const captured: { months: unknown[] }[] = [];
    await handleCreateFlow(
      { profileId: "3", year: 2027 },
      deps({ now: NOW, findOrCreate: async (_u, i) => { captured.push(i); return { id: "9", created: true }; } }),
    );
    expect(captured[0].months).toHaveLength(12);
  });
});

describe("handleCreateFlow — 태어난 해", () => {
  // 1990-01-15 03:30(KST)생 — 그 해 입춘(2/4 무렵)보다 앞이라 달력 연도(1990)와
  // 명리 연도(1989)가 갈린다. birthInstant→flowYearAt으로 직접 확인함:
  // 1989-01-14T18:30Z, 명리 1989년.
  const preIpchunBirth = {
    year: 1990, month: 1, day: 15, hour: 3, minute: 30, gender: "male", calendar: "solar",
  } as const;
  // 1992년으로 잡아 flowYearRange(1987~1997)가 1988·1989를 담게 한다 — 범위
  // 검사가 먼저 걸려 태어난 해 검사를 가리지 않게.
  const NOW = new Date("1992-06-01T00:00:00Z");
  const depsPreIpchun = (overrides: Partial<CreateFlowDeps> = {}) =>
    deps({ now: NOW, getProfile: async () => ({ id: "3", birth: preIpchunBirth }), ...overrides });

  it("명리 생년 이전 해는 400 이다", async () => {
    const res = await handleCreateFlow({ profileId: "3", year: 1988 }, depsPreIpchun());
    expect(res.status).toBe(400);
  });

  it(
    "입춘 전 출생이면 명리 생년(달력 생년 - 1)을 허용한다 — 회귀 테스트: " +
      "birth.year(달력 1990)와 비교하면 명리 1989년(대운 데이터가 있는 정당한 " +
      "구매 대상)을 잘못 막는다",
    async () => {
      const res = await handleCreateFlow({ profileId: "3", year: 1989 }, depsPreIpchun());
      expect(res.status).toBeLessThan(400);
    },
  );

  it("명리 생년 자체는 허용한다 — 경계는 포함이다", async () => {
    // birth 를 입춘 이후로 바꿔 달력 연도와 명리 연도가 같은 평범한 경우도 확인.
    const res = await handleCreateFlow(
      { profileId: "3", year: 1990 },
      deps({ now: NOW, getProfile: async () => ({ id: "3", birth }) }),
    );
    expect(res.status).toBeLessThan(400);
  });
});

describe("flowYearRange — 입춘 경계", () => {
  // solar-term.test.ts 등 기존 테스트가 쓰는 것과 같은 방식으로 절기 순간을
  // 앞뒤로 비껴 잡는다: 입춘 전/후 하루씩.
  it("입춘 직전과 직후는 서로 다른 명리 연도로 범위를 잡는다", () => {
    const ipchun2026 = flowYearOf(2026).start;
    const beforeIpchun = new Date(ipchun2026.getTime() - 24 * 3600_000);
    const afterIpchun = new Date(ipchun2026.getTime() + 24 * 3600_000);

    expect(flowYearRange(beforeIpchun)).toEqual({ min: 2020, max: 2030 });
    expect(flowYearRange(afterIpchun)).toEqual({ min: 2021, max: 2031 });
  });
});
