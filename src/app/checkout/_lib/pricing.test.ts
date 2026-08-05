import { describe, it, expect } from "vitest";
import { FULL_REPORT_PRICE, formatKrw, formatKrwDiscount } from "./pricing";

describe("formatKrw", () => {
  it.each([
    [0, "₩0"],
    [900, "₩900"],
    [9900, "₩9,900"],
    [19900, "₩19,900"],
    [1234567, "₩1,234,567"],
  ])("%i → %s", (won, expected) => {
    expect(formatKrw(won)).toBe(expected);
  });
});

describe("formatKrwDiscount", () => {
  it("하이픈(-)이 아니라 마이너스 기호(−, U+2212)를 쓴다 — 디자인과 같은 글자", () => {
    expect(formatKrwDiscount(10000)).toBe("−₩10,000");
  });
});

describe("FULL_REPORT_PRICE", () => {
  // 정가 - 할인 ≠ 청구금액이면 주문 내역의 세 줄이 서로 다른 말을 한다.
  it("정가에서 할인을 빼면 청구 금액이 된다", () => {
    expect(FULL_REPORT_PRICE.list - FULL_REPORT_PRICE.discount).toBe(FULL_REPORT_PRICE.total);
  });
});
