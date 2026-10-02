import { describe, expect, it } from "vitest";
import { canSubmit, formatOptionDate, optionLabel, serviceKey } from "./types";

describe("formatOptionDate", () => {
  // 2026-10-02 10:00 KST
  const now = new Date("2026-10-02T01:00:00Z");

  it("같은 KST 날짜면 오늘", () => {
    expect(formatOptionDate("2026-10-01T15:30:00Z", now)).toBe("오늘"); // 10-02 00:30 KST
  });

  it("KST 로 하루 전이면 어제 — UTC 로는 같은 날이어도", () => {
    expect(formatOptionDate("2026-10-01T14:59:00Z", now)).toBe("어제"); // 10-01 23:59 KST
  });

  it("그보다 전이면 M월 D일", () => {
    expect(formatOptionDate("2026-09-24T03:00:00Z", now)).toBe("9월 24일");
  });

  it("날짜가 없으면 빈 문자열 — '기타' 줄", () => {
    expect(formatOptionDate(null, now)).toBe("");
  });
});

describe("canSubmit", () => {
  const empty = { pick: null, reason: null, text: "" };

  it("오류 문의는 항목과 설명이 둘 다 있어야 한다", () => {
    expect(canSubmit("error", { ...empty, pick: "map:3" })).toBe(false);
    expect(canSubmit("error", { ...empty, text: "안 열려요" })).toBe(false);
    expect(canSubmit("error", { ...empty, pick: "map:3", text: "안 열려요" })).toBe(true);
  });

  it("공백만 있는 설명은 빈 설명이다", () => {
    expect(canSubmit("error", { ...empty, pick: "map:3", text: "  \n " })).toBe(false);
    expect(canSubmit("feedback", { ...empty, text: "   " })).toBe(false);
  });

  it("피드백은 내용만 있으면 된다", () => {
    expect(canSubmit("feedback", { ...empty, text: "좋아요" })).toBe(true);
  });

  it("환불은 결제 건과 사유가 있어야 하고 설명은 선택이다", () => {
    expect(canSubmit("refund", { ...empty, pick: "9" })).toBe(false);
    expect(canSubmit("refund", { ...empty, reason: "기타" })).toBe(false);
    expect(canSubmit("refund", { ...empty, pick: "9", reason: "기타" })).toBe(true);
  });
});

describe("serviceKey / optionLabel", () => {
  it("ref 가 없는 '기타' 도 고유한 키를 갖는다", () => {
    expect(serviceKey({ kind: "other", ref: null })).toBe("other:");
    expect(serviceKey({ kind: "map", ref: "3" })).toBe("map:3");
  });

  it("라벨은 제목 · 부제", () => {
    expect(optionLabel({ title: "궁합", sub: "동진 × 민수" })).toBe("궁합 · 동진 × 민수");
  });
});
