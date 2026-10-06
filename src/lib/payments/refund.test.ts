import { describe, it, expect } from "vitest";
import { isRefundable, refundAmount, refundWindowStart } from "./refund";

const NOW = new Date("2026-10-02T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("refundAmount", () => {
  it("쓴 장수를 장당 1,000원으로 뺀다 — 6장 5,000원에서 2장 쓰면 3,000원", () => {
    expect(refundAmount({ amount: 5000, tickets: 6, remaining: 4 })).toBe(3000);
  });

  it("한 장도 안 썼으면 전액", () => {
    expect(refundAmount({ amount: 5000, tickets: 6, remaining: 6 })).toBe(5000);
  });

  // 묶음 할인·보너스는 "다 쓰는 조건" 이다 — 쓴 만큼 정가로 치면 환불액이 0 이 될 수 있다.
  it("정가로 친 사용액이 결제액을 넘으면 0 — 13장 10,000원에서 10장 사용", () => {
    expect(refundAmount({ amount: 10000, tickets: 13, remaining: 3 })).toBe(0);
  });

  it("remaining 이 NULL(백필 전)이면 0 으로 본다", () => {
    expect(refundAmount({ amount: 1000, tickets: 1, remaining: null })).toBe(0);
  });

  it("tickets 가 NULL(옛 행)이면 0 으로 본다 — 음수 사용량이 생기면 안 된다", () => {
    expect(refundAmount({ amount: 1000, tickets: null, remaining: null })).toBe(0);
  });
});

describe("refundWindowStart", () => {
  it("지금에서 7일 전", () => {
    expect(refundWindowStart(NOW).getTime()).toBe(NOW.getTime() - 7 * DAY);
  });
});

describe("isRefundable", () => {
  const base = { status: "paid", amount: 5000, tickets: 6, remaining: 4, paidAt: new Date(NOW.getTime() - DAY) };

  it("paid · 7일 이내 · 남은 장수 있음 · 환불액 > 0 이면 true", () => {
    expect(isRefundable(base, NOW)).toBe(true);
  });

  it("정확히 7일 전은 아직 가능하다 — 경계는 포함", () => {
    expect(isRefundable({ ...base, paidAt: new Date(NOW.getTime() - 7 * DAY) }, NOW)).toBe(true);
  });

  it("7일에서 1ms 지나면 불가", () => {
    expect(isRefundable({ ...base, paidAt: new Date(NOW.getTime() - 7 * DAY - 1) }, NOW)).toBe(false);
  });

  it("이미 환불된 행은 불가", () => {
    expect(isRefundable({ ...base, status: "refunded" }, NOW)).toBe(false);
  });

  it("남은 장수가 0 이면 불가", () => {
    expect(isRefundable({ ...base, remaining: 0 }, NOW)).toBe(false);
  });

  it("남은 장수는 있어도 환불액이 0 이면 불가", () => {
    expect(isRefundable({ ...base, amount: 10000, tickets: 13, remaining: 3 }, NOW)).toBe(false);
  });

  it("remaining NULL(백필 전)·paid_at NULL 은 불가", () => {
    expect(isRefundable({ ...base, remaining: null }, NOW)).toBe(false);
    expect(isRefundable({ ...base, paidAt: null }, NOW)).toBe(false);
  });
});
