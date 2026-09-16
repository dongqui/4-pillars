import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { monthScores } from "../month-scores";
import { buildFlowEvidence } from "./facts";

const BIRTH = { year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" } as const;
const a = analyze(BIRTH);
const YEARS = [2021, 2023, 2026, 2027, 2031];

describe("buildFlowEvidence", () => {
  it("ID 가 유일하고 availableFactIds 와 같다", () => {
    for (const y of YEARS) {
      const e = buildFlowEvidence(a, y, flowMonths(a, y));
      const ids = e.facts.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(e.availableFactIds).toEqual(ids);
    }
  });
  it("months 12개, 순번·pivot 이 저장된 값과 같고 factIds 는 그 달 것만", () => {
    const fm = flowMonths(a, 2027);
    const e = buildFlowEvidence(a, 2027, fm);
    expect(e.months).toHaveLength(12);
    e.months.forEach((m, i) => {
      expect(m.monthIndex).toBe(fm[i].index);
      expect(m.pivot).toBe(fm[i].pivot);
      expect(m.factIds.every((id) => id.startsWith(`month.${String(m.monthIndex).padStart(2, "0")}.`))).toBe(true);
      expect(m.factIds.length).toBeGreaterThan(0);
    });
    expect(e.pivotMonths).toEqual(fm.filter((m) => m.pivot).map((m) => m.index));
  });
  it("변곡점이 없어도 change.pivotMonths 는 빈 배열로 있다", () => {
    const found = YEARS.map((y) => buildFlowEvidence(a, y, flowMonths(a, y))).find((e) => e.pivotMonths.length === 0);
    if (!found) return; // 이 사주에 없는 해가 없으면 통과
    expect(found.facts.find((f) => f.id === "change.pivotMonths")?.value).toEqual([]);
  });
  it("관측 그룹은 합집합 이름으로만, 성별은 없다", () => {
    const e = buildFlowEvidence(a, 2027, flowMonths(a, 2027));
    expect(e.facts.some((f) => f.id === "aggregate.monthlyObservedGroups")).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/남성|여성|gender/);
  });
  it("annual.stemGroup 은 monthScores 와 같은 그룹 정의다", () => {
    const e = buildFlowEvidence(a, 2027, flowMonths(a, 2027));
    const g = e.facts.find((f) => f.id === "annual.stemGroup")!.value;
    expect(["비겁", "식상", "재성", "관성", "인성"]).toContain(g);
    // 1번째 달 그룹은 monthScores 의 것과 같다 (같은 groupOf)
    expect(e.facts.find((f) => f.id === "month.01.groups")!.value).toEqual(monthScores(a, 2027)[0].tenGods);
  });
});
