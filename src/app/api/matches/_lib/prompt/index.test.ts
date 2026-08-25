import { describe, expect, it } from "vitest";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import type { BirthInput } from "@/lib/saju-core";
import { RELATION_COPY } from "@/lib/matches/relation-copy";
import { buildMatchSectionRequest, MATCH_SYSTEM_PROMPT, type MatchContext } from "./index";

const birth = (year: number, month: number, day: number): BirthInput => ({
  year, month, day, hour: 10, minute: 0, gender: "male", calendar: "solar",
});

function ctx(relation: MatchContext["relation"]): MatchContext {
  const subject = analyze(birth(1990, 10, 25));
  const counterpart = analyze(birth(1993, 4, 12));
  return { subject, counterpart, synastry: analyzeSynastry(subject, counterpart), relation };
}

const rel = (type: MatchContext["relation"]["type"]) => ({
  type,
  subjectRole: null,
  counterpartRole: null,
});

describe("관점 블록", () => {
  it("variants 가 빈 섹션에는 블록이 없다 — §17 의 '영향을 적게 받는 섹션'", () => {
    const req = buildMatchSectionRequest(ctx(rel("lover")), "verdict");
    expect(req.user).not.toContain("[이 관계에서 볼 장면");
  });

  it("together 는 06·07 두 블록을 다 싣는다 — 한 콜이 두 화면을 만든다", () => {
    const req = buildMatchSectionRequest(ctx(rel("lover")), "together");
    expect(req.user).toContain(`[이 관계에서 볼 장면 · ${RELATION_COPY.lover.presence.category}]`);
    expect(req.user).toContain(
      `[이 관계에서 볼 장면 · ${RELATION_COPY.lover.continuity.category}]`,
    );
  });

  it("같은 섹션이 유형에 따라 다른 관점을 싣는다", () => {
    const lover = buildMatchSectionRequest(ctx(rel("lover")), "closeness").user;
    const work = buildMatchSectionRequest(ctx(rel("work")), "closeness").user;
    // 문구의 정본은 RELATION_COPY 한 곳이다. 리터럴을 여기 다시 적으면 카피를 한 줄
    // 다듬을 때 이 파일이 같이 깨진다. 대신 목록 전체가 실렸는지를 본다 — 단언이 오히려 강해진다.
    for (const angle of RELATION_COPY.work.closeness.angles) {
      expect(work, angle).toContain(`- ${angle}`);
    }
    for (const angle of RELATION_COPY.lover.closeness.angles) {
      expect(lover, angle).toContain(`- ${angle}`);
    }
    // 남의 유형 관점이 새어 들어오지 않는다.
    expect(work).not.toContain(`- ${RELATION_COPY.lover.closeness.angles[0]}`);
  });

  it("금지선이 있으면 함께 실린다", () => {
    const req = buildMatchSectionRequest(ctx(rel("spouse")), "together");
    expect(req.user).toContain(`제한: ${RELATION_COPY.spouse.continuity.caution}`);
  });

  it("유형이 없어도 블록이 나온다 — 기타 카피로 물러선다", () => {
    const req = buildMatchSectionRequest(ctx(rel(null)), "advice");
    expect(req.user).toContain("[이 관계에서 볼 장면");
  });

  it("관점 블록은 [요청] 앞에 온다 — 지시문보다 재료가 먼저다", () => {
    const req = buildMatchSectionRequest(ctx(rel("lover")), "advice");
    expect(req.user.indexOf("[이 관계에서 볼 장면")).toBeLessThan(
      req.user.indexOf("[요청 · advice]"),
    );
  });
});

describe("MATCH_SYSTEM_PROMPT", () => {
  it("연애가 아닌 관계에 연애를 씌우지 말라는 규칙이 있다", () => {
    expect(MATCH_SYSTEM_PROMPT).toContain("질투");
  });

  it("금지 문구 목록이 있다", () => {
    for (const banned of ["천생연분", "결혼해야 한다", "사업하면 성공한다"]) {
      expect(MATCH_SYSTEM_PROMPT, banned).toContain(banned);
    }
  });

  it("미래를 단정하는 어미를 금지한다", () => {
    expect(MATCH_SYSTEM_PROMPT).toContain("반드시 ~하게 됩니다");
  });
});
