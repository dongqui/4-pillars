import { describe, expect, it } from "vitest";
import { toStartOutcome } from "./to-start-outcome";

describe("toStartOutcome", () => {
  it("402 — 이용권 부족을 안내하고 충전 경로로 보낸다", () => {
    const out = toStartOutcome(402);
    expect(out?.text).toContain("이용권이 부족해요");
    expect(out?.action?.href).toBe("/checkout?next=%2Fflow");
  });

  it("429 — 시간당 한도를 안내하되 구체적인 대기 시간은 약속하지 않는다", () => {
    const out = toStartOutcome(429);
    expect(out?.text).toContain("시간당 한도");
    expect(out?.text).not.toMatch(/\d+\s*(시간|분)/);
    expect(out?.action).toBeUndefined();
  });

  it("401 — 로그인이 끊겼다고 안내하고 로그인 경로로 보낸다", () => {
    const out = toStartOutcome(401);
    expect(out?.text).toContain("로그인");
    expect(out?.action?.href).toBe("/login?next=%2Fflow");
  });

  it("그 외 상태 — 중립적인 재시도 안내로 물러선다", () => {
    expect(toStartOutcome(500)).toEqual({ text: "잠시 후 다시 시도해 주세요." });
  });

  it("성공(2xx)이면 보여줄 문구가 없다", () => {
    expect(toStartOutcome(200)).toBeNull();
    expect(toStartOutcome(201)).toBeNull();
  });
});
