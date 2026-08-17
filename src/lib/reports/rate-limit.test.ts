import { describe, it, expect, vi } from "vitest";
import {
  ANON_REPORT_LIMIT,
  checkAnonReportLimit,
  extractClientIp,
  type RateLimitClient,
} from "./rate-limit";

function client(overrides: Partial<RateLimitClient> = {}): RateLimitClient {
  return {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => "OK"),
    ...overrides,
  };
}

describe("checkAnonReportLimit", () => {
  it("한도 안이면 통과시킨다", async () => {
    const c = client({ incr: vi.fn(async () => ANON_REPORT_LIMIT) });
    expect(await checkAnonReportLimit("1.2.3.4", c)).toBe(true);
    expect(c.incr).toHaveBeenCalledWith("report:anon:1.2.3.4");
  });

  it("한도를 넘으면 막는다", async () => {
    const c = client({ incr: vi.fn(async () => ANON_REPORT_LIMIT + 1) });
    expect(await checkAnonReportLimit("1.2.3.4", c)).toBe(false);
  });

  it("첫 카운트에만 TTL 을 건다 — NX 로 윈도를 연장하지 않는다", async () => {
    const c = client();
    await checkAnonReportLimit("1.2.3.4", c);
    expect(c.expire).toHaveBeenCalledWith("report:anon:1.2.3.4", 3600, "NX");
  });

  it("Redis 가 죽으면 막는다 — 여기엔 DB 상한 같은 최후 방어선이 없다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = client({
      incr: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    expect(await checkAnonReportLimit("1.2.3.4", c)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("expire 실패는 판단을 뒤집지 않는다", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = client({
      incr: vi.fn(async () => 1),
      expire: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    expect(await checkAnonReportLimit("1.2.3.4", c)).toBe(true);
    spy.mockRestore();
  });
});

describe("extractClientIp", () => {
  it("x-forwarded-for 의 오른쪽 끝을 쓴다 — 왼쪽은 호출자가 위조할 수 있다", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 203.0.113.7" });
    expect(extractClientIp(h)).toBe("203.0.113.7");
  });

  it("x-forwarded-for 가 없으면 x-real-ip 를 본다", () => {
    expect(extractClientIp(new Headers({ "x-real-ip": " 203.0.113.7 " }))).toBe("203.0.113.7");
  });

  it("둘 다 없으면 unknown 으로 묶는다 — 못 나누면 한 통에 넣는다", () => {
    expect(extractClientIp(new Headers())).toBe("unknown");
    expect(extractClientIp(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
