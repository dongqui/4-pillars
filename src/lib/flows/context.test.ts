import { describe, expect, it } from "vitest";
import {
  CAREER_OPTIONS, RELATIONSHIP_OPTIONS, CONCERN_OPTIONS,
  careerTitle, contextAnswerSchema, isContextComplete, normalizeFlowContext, yearRelationOf,
} from "./context";

const now = new Date("2026-09-16T00:00:00.000Z");

describe("normalizeFlowContext", () => {
  it("미응답을 개인 이력으로 채우지 않는다", () => {
    expect(normalizeFlowContext(undefined, { relation: "present", now })).toEqual({
      career: "unspecified", relationship: "unspecified", mainConcern: "overall",
      reference: "unspecified", asOf: "2026-09-16T00:00:00.000Z",
    });
  });
  it("지난 해에 답하면 그 해 초의 상황이다", () => {
    expect(normalizeFlowContext(
      { career: "student", relationship: "unspecified", mainConcern: "career" },
      { relation: "past", now },
    ).reference).toBe("selected_year_start");
  });
  it("올해·다가올 해에 답하면 지금 기준이다", () => {
    for (const relation of ["present", "future"] as const) {
      expect(normalizeFlowContext(
        { career: "unspecified", relationship: "dating", mainConcern: "overall" },
        { relation, now },
      ).reference).toBe("current_baseline");
    }
  });
  it("관심 분야만 답하면 기준 시점이 없다", () => {
    expect(normalizeFlowContext(
      { career: "unspecified", relationship: "unspecified", mainConcern: "money" },
      { relation: "past", now },
    )).toMatchObject({ mainConcern: "money", reference: "unspecified" });
  });
});

describe("careerTitle", () => {
  it("상황 제목은 하나의 매핑을 쓴다", () => {
    expect(careerTitle("employed")).toBe("직업운");
    expect(careerTitle("freelance")).toBe("직업운");
    expect(careerTitle("business")).toBe("직업운");
    expect(careerTitle("student")).toBe("학업운");
    expect(careerTitle("preparing")).toBe("취업·진로운");
    expect(careerTitle("taking_break")).toBe("일과 활동");
    expect(careerTitle("home_care")).toBe("일과 활동");
    expect(careerTitle("unspecified")).toBe("일과 활동");
  });
});

describe("contextAnswerSchema", () => {
  it("세 필드 모두 필수다", () => {
    expect(contextAnswerSchema.safeParse({ career: "employed", relationship: "single" }).success).toBe(false);
  });
  it("reference·asOf 를 보내면 거절한다 — 서버가 파생한다", () => {
    expect(contextAnswerSchema.safeParse({
      career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline",
    }).success).toBe(false);
  });
  it("모든 선택지가 정의역에 있다", () => {
    for (const c of CAREER_OPTIONS) for (const r of RELATIONSHIP_OPTIONS) for (const m of CONCERN_OPTIONS) {
      expect(contextAnswerSchema.safeParse({ career: c.value, relationship: r.value, mainConcern: m.value }).success).toBe(true);
    }
  });
});

describe("isContextComplete", () => {
  it("셋 다 골라야 true", () => {
    expect(isContextComplete({ career: "employed", relationship: "single", mainConcern: null })).toBe(false);
    expect(isContextComplete({ career: "employed", relationship: "single", mainConcern: "overall" })).toBe(true);
  });
});

describe("yearRelationOf", () => {
  it("현재 명리 연도 기준이다 (2026-09-16 은 명리 2026년)", () => {
    expect(yearRelationOf(2025, now)).toBe("past");
    expect(yearRelationOf(2026, now)).toBe("present");
    expect(yearRelationOf(2027, now)).toBe("future");
  });
});
