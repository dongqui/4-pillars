import { describe, it, expect } from "vitest";
import { DEFAULT_NEXT, safeNextPath } from "./next-param";

describe("safeNextPath", () => {
  it("내부 절대 경로는 그대로 통과한다", () => {
    expect(safeNextPath("/report?profile=3")).toBe("/report?profile=3");
    expect(safeNextPath("/home")).toBe("/home");
  });

  it("없으면 기본값", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT);
  });

  it("외부 URL 은 기본값으로 접는다 — 통과시키면 오픈 리다이렉트다", () => {
    expect(safeNextPath("https://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("http://evil.example")).toBe(DEFAULT_NEXT);
  });

  it("스킴 상대 URL 을 막는다 — 브라우저는 //evil.example 를 외부로 읽는다", () => {
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_NEXT);
  });

  it("백슬래시 변형을 막는다 — 일부 브라우저가 /\\ 를 // 로 정규화한다", () => {
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("제어문자가 섞인 값을 막는다 — 개행으로 검사를 우회할 수 있다", () => {
    expect(safeNextPath("/\nhttps://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/re\tport")).toBe(DEFAULT_NEXT);
    // DEL (U+007F)과 C1 제어문자 (U+0080–U+009F)도 거절한다
    expect(safeNextPath("/home\x7f")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/home\x81")).toBe(DEFAULT_NEXT);
  });

  it("상대 경로도 막는다 — 어느 화면 기준인지 알 수 없다", () => {
    expect(safeNextPath("report")).toBe(DEFAULT_NEXT);
  });
});
