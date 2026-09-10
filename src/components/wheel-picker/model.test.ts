import { describe, it, expect } from "vitest";
import {
  WHEEL_ITEM_HEIGHT,
  WHEEL_PAD,
  indexFromScroll,
  range,
  scrollForIndex,
} from "./model";

describe("wheel-picker model", () => {
  it("range는 양 끝을 포함한다 — 분은 0~59 로 60칸", () => {
    const minutes = range(0, 59);
    expect(minutes).toHaveLength(60);
    expect(minutes[0]).toBe(0);
    expect(minutes[59]).toBe(59);
    expect(range(1, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("indexFromScroll은 가장 가까운 칸을 고른다", () => {
    expect(indexFromScroll(0, 10)).toBe(0);
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 3, 10)).toBe(3);
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 3 + 20, 10)).toBe(3);
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 3 + 23, 10)).toBe(4);
  });

  it("indexFromScroll은 범위 밖을 끝 칸으로 붙인다", () => {
    expect(indexFromScroll(-30, 10)).toBe(0);
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 99, 10)).toBe(9);
    expect(indexFromScroll(100, 0)).toBe(0);
  });

  it("scrollForIndex와 indexFromScroll은 서로 역이다", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(indexFromScroll(scrollForIndex(i), 60)).toBe(i);
    }
  });

  it("선택 띠는 위로 두 칸 떨어져 있다(5줄 중 가운데)", () => {
    expect(WHEEL_PAD).toBe(WHEEL_ITEM_HEIGHT * 2);
  });
});
