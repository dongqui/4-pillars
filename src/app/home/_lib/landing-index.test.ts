import { describe, expect, it } from "vitest";
import { landingIndex } from "./landing-index";

describe("landingIndex", () => {
  it("보고 있던 줄보다 위를 지우면 목록이 당겨진다", () => {
    // 원래 2번이던 사람이 1번 자리로 온다
    expect(landingIndex(3, 0, 2)).toBe(1);
  });

  it("보고 있던 줄 자신을 지웠고 마지막이 아니면 그 자리로 다음 줄이 올라온다", () => {
    expect(landingIndex(3, 1, 1)).toBe(1);
  });

  it("보고 있던 줄이 마지막이었으면 한 칸 앞으로 물러선다", () => {
    expect(landingIndex(3, 2, 2)).toBe(1);
  });

  it("보고 있던 줄보다 아래를 지우면 자리가 그대로다", () => {
    expect(landingIndex(3, 2, 0)).toBe(0);
  });

  it("마지막 한 줄을 지우면 착지할 자리가 없다", () => {
    expect(landingIndex(1, 0, 0)).toBe(-1);
  });
});
