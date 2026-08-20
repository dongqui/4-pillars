import { describe, it, expect } from "vitest";
import { PAYMENT_ID_PREFIX, newPaymentId } from "./order-id";

describe("newPaymentId", () => {
  it("토스 콘솔에서 우리 주문임을 알아보게 접두사를 붙인다", () => {
    expect(newPaymentId().startsWith(PAYMENT_ID_PREFIX)).toBe(true);
  });

  it("부를 때마다 다르다 — 같은 ID 를 두 번 쓰면 두 번째 결제가 거부된다", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newPaymentId()));
    expect(ids.size).toBe(100);
  });

  it("영문·숫자·하이픈만 쓴다 — URL 경로에 그대로 들어가는 값이다", () => {
    expect(newPaymentId()).toMatch(/^[a-z0-9-]+$/);
  });
});
