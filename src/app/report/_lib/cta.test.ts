import { describe, it, expect } from "vitest";
import { ctaHref } from "./cta";

describe("ctaHref", () => {
  it("로그인 상태면 목적지로 바로 보낸다", () => {
    expect(ctaHref("/map", true)).toBe("/map");
    expect(ctaHref("/match", true)).toBe("/match");
  });

  it("비로그인이면 로그인 화면을 거쳐 돌아오게 한다", () => {
    expect(ctaHref("/map", false)).toBe("/login?next=%2Fmap");
    expect(ctaHref("/match", false)).toBe("/login?next=%2Fmatch");
  });

  // 인코딩하지 않으면 next 가 쿼리 경계에서 잘린다.
  it("목적지를 인코딩한다", () => {
    expect(ctaHref("/match?from=report", false)).toBe(
      "/login?next=%2Fmatch%3Ffrom%3Dreport",
    );
  });
});
