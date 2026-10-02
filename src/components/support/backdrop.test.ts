import { describe, expect, it } from "vitest";
import { isOutsideRect } from "./backdrop";

describe("isOutsideRect", () => {
  const card = { left: 100, top: 50, right: 560, bottom: 650 };

  it("카드 안쪽 여백·간격을 누른 것은 바깥이 아니다 — 쓰던 내용을 날리면 안 된다", () => {
    expect(isOutsideRect(card, 105, 55)).toBe(false);
    expect(isOutsideRect(card, 330, 400)).toBe(false);
  });

  it("경계선 위는 안쪽이다", () => {
    expect(isOutsideRect(card, 100, 50)).toBe(false);
    expect(isOutsideRect(card, 560, 650)).toBe(false);
  });

  it("카드 밖(백드롭)은 바깥이다", () => {
    expect(isOutsideRect(card, 99, 300)).toBe(true);
    expect(isOutsideRect(card, 300, 651)).toBe(true);
    expect(isOutsideRect(card, 300, 10)).toBe(true);
  });
});
