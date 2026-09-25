import { describe, it, expect } from "vitest";
import { TEST_CHART_CRITERIA, criterionIds, renderCriteria } from "./criteria";

describe("TEST_CHART_CRITERIA", () => {
  it("모든 기준이 다섯 칸을 채운다 — 특히 판단할 수 없는 것", () => {
    for (const c of TEST_CHART_CRITERIA) {
      expect(c.basis.length, c.id).toBeGreaterThan(0);
      expect(c.when.length, c.id).toBeGreaterThan(0);
      expect(c.allows.length, c.id).toBeGreaterThan(0);
      expect(c.cannot.length, c.id).toBeGreaterThan(0);
      expect(c.plain.length, c.id).toBeGreaterThan(0);
    }
  });

  it("id 가 겹치지 않는다 — basis 로 돌아온 id 를 되찾을 수 있어야 한다", () => {
    expect(criterionIds(TEST_CHART_CRITERIA).size).toBe(TEST_CHART_CRITERIA.length);
  });

  // 실측에서 뒤집힌 자리다. 비겁 기준이 갈등 회피/자기주장 어느 쪽도 말하지 않게 묶어 둔다.
  it("비겁 기준은 거절·갈등의 방향을 판단 밖에 둔다", () => {
    const c = TEST_CHART_CRITERIA.find((x) => x.id === "bigyeop-dominant")!;
    expect(c.cannot).toContain("갈등");
    expect(c.cannot).toContain("거절");
  });

  // 뒷받침이 확인되지 않은 추정은 기준에서 뺀다 — 모델에게 충돌 해결을 맡기지 않는다.
  it("허용 해석과 쉬운 표현이 판단 밖의 내용을 담지 않는다", () => {
    const gwan = TEST_CHART_CRITERIA.find((x) => x.id === "no-gwanseong")!;
    expect(`${gwan.allows} ${gwan.plain}`).not.toContain("익숙");
    const jae = TEST_CHART_CRITERIA.find((x) => x.id === "jeongjae-only")!;
    expect(`${jae.allows} ${jae.plain}`).not.toContain("경험");
  });

  // "무기력하게 느껴질 수 있는 시기" 로 말을 눕혀 판단 밖을 넘어간 적이 있다.
  it("약하게 쓴 말도 같은 주장이라고 기준에 적는다", () => {
    const c = TEST_CHART_CRITERIA.find((x) => x.id === "inseong-year")!;
    expect(c.cannot).toContain("발생 가능성");
    expect(c.cannot).toContain("약하게 쓴 말도 같은 주장");
  });

  it("흐름 기준은 원인·회복 시점을 판단 밖에 둔다", () => {
    const c = TEST_CHART_CRITERIA.find((x) => x.id === "inseong-year")!;
    expect(c.kind).toBe("흐름");
    expect(c.cannot).toContain("회복 시점");
  });
});

describe("renderCriteria", () => {
  it("계산 사실이 아니라 채택한 해석이라고 머리말에 적는다", () => {
    const block = renderCriteria(TEST_CHART_CRITERIA);
    expect(block).toContain("[해석 기준]");
    expect(block).toContain("계산 결과가 아니라");
    expect(block).toContain("질문을 보기 전에 정해졌다");
  });

  it("기준마다 id 와 다섯 칸을 모두 싣는다", () => {
    const block = renderCriteria([TEST_CHART_CRITERIA[0]]);
    expect(block).toContain("### bigyeop-dominant");
    expect(block).toContain("근거 항목:");
    expect(block).toContain("적용 조건:");
    expect(block).toContain("허용하는 해석:");
    expect(block).toContain("이 근거로 판단할 수 없는 것:");
    expect(block).toContain("쉬운 표현:");
  });

  it("기준이 없으면 빈 문자열이다 — 빈 블록을 붙이지 않는다", () => {
    expect(renderCriteria([])).toBe("");
  });
});
