import { describe, it, expect } from "vitest";
import { PAYMENT_ID_PREFIX, newPaymentId } from "./order-id";

describe("newPaymentId", () => {
  it("포트원 콘솔에서 우리 주문임을 알아보게 접두사를 붙인다", () => {
    expect(newPaymentId().startsWith(PAYMENT_ID_PREFIX)).toBe(true);
  });

  it("부를 때마다 다르다 — 같은 ID 를 두 번 쓰면 KCP 가 두 번째 결제를 거부한다", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newPaymentId()));
    expect(ids.size).toBe(100);
  });

  it("영문 소문자·숫자만 쓴다 — KCP 는 paymentId 에 특수문자(하이픈 포함)를 받지 않는다", () => {
    for (let i = 0; i < 20; i++) expect(newPaymentId()).toMatch(/^[a-z0-9]+$/);
  });

  it("40자를 넘지 않는다 — KCP 의 paymentId 상한이다. 접두사 4 + uuid 32 = 36", () => {
    expect(newPaymentId()).toHaveLength(36);
  });
});
