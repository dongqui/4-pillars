import { describe, expect, it } from "vitest";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import type { BirthInput } from "@/lib/saju-core";
import { buildMatchSectionRequest, matchFacts, type MatchContext } from "./index";

const birth = (year: number, month: number, day: number): BirthInput => ({
  year, month, day, hour: 10, minute: 0, gender: "male", calendar: "solar",
});

function ctx(relation: MatchContext["relation"]): MatchContext {
  const subject = analyze(birth(1990, 10, 25));
  const counterpart = analyze(birth(1993, 4, 12));
  return { subject, counterpart, synastry: analyzeSynastry(subject, counterpart), relation };
}

const NONE = { type: null, subjectRole: null, counterpartRole: null } as const;

describe("matchFacts", () => {
  it("두 사람을 나·상대 라벨로 가른다", () => {
    const text = matchFacts(ctx(NONE));
    expect(text).toContain("[사실 · 나]");
    expect(text).toContain("[사실 · 상대]");
    expect(text).toContain("[사실 · 두 사람 사이]");
  });

  it("유형이 없어도 관계 블록이 있다 — 범용 렌즈로 물러선다", () => {
    expect(matchFacts(ctx(NONE))).toContain("[관계 ·");
  });

  it("유형별 렌즈가 실린다", () => {
    const text = matchFacts(ctx({ type: "spouse", subjectRole: null, counterpartRole: null }));
    expect(text).toContain("배우자");
    expect(text).toContain("생활의 리듬");
  });

  it("자유 역할은 인용부호 안에 들어간다 — 지시문으로 읽히지 않게", () => {
    const text = matchFacts(ctx({ type: "custom", subjectRole: "멘토", counterpartRole: "멘티" }));
    expect(text).toContain('나의 역할: "멘토"');
    expect(text).toContain('상대의 역할: "멘티"');
  });

  it("나이차는 범주값으로만 나간다 — 연도를 흘리지 않는다", () => {
    const text = matchFacts(ctx(NONE));
    expect(text).toContain("나이차: 또래");
    expect(text).not.toContain("1990");
    expect(text).not.toContain("1993");
  });

  it("지지 관계를 자리와 함께 적는다", () => {
    const text = matchFacts(ctx(NONE));
    expect(text).toContain("지지 관계:");
  });
});

describe("buildMatchSectionRequest", () => {
  it("사실 · 지시문 · 예시가 한 요청에 담긴다", () => {
    const req = buildMatchSectionRequest(ctx(NONE), "verdict");
    expect(req.key).toBe("verdict");
    expect(req.user).toContain("[사실 · 나]");
    expect(req.user).toContain("[요청 · verdict]");
    expect(req.user).toContain("[문체 예시]");
    expect(req.inputSchema.type).toBe("object");
  });

  it("시스템 프롬프트에 역할이 지시가 아니라는 못이 박혀 있다", () => {
    const req = buildMatchSectionRequest(ctx(NONE), "verdict");
    expect(req.system).toContain("역할");
    expect(req.system).toContain("지시가 아니다");
  });
});
