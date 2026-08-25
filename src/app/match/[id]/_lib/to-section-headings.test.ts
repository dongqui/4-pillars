import { describe, expect, it } from "vitest";
import type { RelationInput } from "@/lib/matches/relation-types";
import { RELATION_COPY } from "@/lib/matches/relation-copy";
import { matchSectionHeadings, SCREEN_SECTION_ORDER } from "./to-section-headings";

const rel = (type: RelationInput["type"]): RelationInput => ({
  type,
  subjectRole: null,
  counterpartRole: null,
});

describe("matchSectionHeadings", () => {
  it("번호는 01 부터 10 까지 겹치지 않는다", () => {
    const heads = matchSectionHeadings(rel("lover"));
    const numbers = SCREEN_SECTION_ORDER.map((k) => heads[k].no);
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  });

  it("유형 무관 섹션은 유형이 바뀌어도 같다", () => {
    const a = matchSectionHeadings(rel("lover"));
    const b = matchSectionHeadings(rel("work"));
    expect(a.chemistry).toEqual(b.chemistry);
    expect(a.eachSide).toEqual(b.eachSide);
    expect(a.triggers).toEqual(b.triggers);
  });

  it("유형별 섹션은 유형에 따라 갈린다 — 직장 상하가 '다가가는 법' 을 읽지 않는다", () => {
    const spouse = matchSectionHeadings(rel("spouse"));
    const work = matchSectionHeadings(rel("work"));
    // 문구의 정본은 RELATION_COPY 한 곳이다. 리터럴을 여기 다시 적으면 카피를 한 줄
    // 다듬을 때 관계없는 이 파일이 같이 깨진다.
    expect(spouse.closeness.category).toBe(RELATION_COPY.spouse.closeness.category);
    expect(work.closeness.category).toBe(RELATION_COPY.work.closeness.category);
    expect(spouse.closeness.category).not.toBe(work.closeness.category);
    expect(spouse.continuity.category).not.toBe(work.continuity.category);
  });

  it("01 의 제목은 null 이다 — 총평 제목은 카피가 아니라 headline 에서 온다", () => {
    expect(matchSectionHeadings(rel("lover")).verdict.title).toBeNull();
    expect(matchSectionHeadings(rel("lover")).verdict.category).toBe("총평");
  });

  it("유형이 없으면 기타 카피로 물러선다 — 건너뛰기가 막다른 길이 되면 안 된다", () => {
    const none = matchSectionHeadings(rel(null));
    expect(none.advice.title).toBe(RELATION_COPY.custom.advice.title);
  });
});
