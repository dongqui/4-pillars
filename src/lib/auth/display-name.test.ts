import { describe, expect, it } from "vitest";
import { displayInitial, resolveDisplayName } from "./display-name";

describe("resolveDisplayName", () => {
  it("이름이 있으면 그대로 쓴다", () => {
    expect(resolveDisplayName({ displayName: "지우" })).toBe("지우");
  });

  it("앞뒤 공백은 털어낸다", () => {
    expect(resolveDisplayName({ displayName: "  지우  " })).toBe("지우");
  });

  it("제공자가 이름을 안 주면 폴백한다", () => {
    expect(resolveDisplayName({ displayName: null })).toBe("회원");
  });

  it("공백만 있는 이름도 폴백한다 — trim 후 빈 문자열이면 이름이 없는 것과 같다", () => {
    expect(resolveDisplayName({ displayName: "   " })).toBe("회원");
  });

  it("유저 조회 자체가 실패해 null 이 와도 폴백한다", () => {
    expect(resolveDisplayName(null)).toBe("회원");
  });
});

describe("displayInitial", () => {
  it("첫 글자를 뽑는다", () => {
    expect(displayInitial("지우")).toBe("지");
  });

  it("이모지를 반 토막 내지 않는다", () => {
    expect(displayInitial("🙂지우")).toBe("🙂");
  });

  it("빈 문자열이면 물음표", () => {
    expect(displayInitial("")).toBe("?");
  });
});
