import { describe, expect, it } from "vitest";

import { buildChart } from "./chart";
import { generatedBy } from "./data/relations";
import type { Element } from "./data/stems";
import {
  elementProfile,
  elementProfileCopy,
  profileElements,
} from "./element-profile";

/** 목화토금수 순서로 개수만 적어 만드는 테스트용 집계 */
function counts(목: number, 화: number, 토: number, 금: number, 수: number) {
  return { 목, 화, 토, 금, 수 } as Record<Element, number>;
}

describe("elementProfile — 최다·결핍 판정", () => {
  it("최다와 결핍을 뽑는다", () => {
    const p = elementProfile(counts(0, 2, 2, 3, 1), "금");
    expect(p.dominant).toBe("금");
    expect(p.lacking).toBe("목");
    expect(p.absent).toEqual(["목"]);
    expect(p.isBalanced).toBe(false);
  });

  it("0개인 오행이 여럿이면 전부 absent에 담는다", () => {
    const p = elementProfile(counts(0, 4, 0, 3, 1), "화");
    expect(p.absent).toEqual(["목", "토"]);
  });

  it("0개가 없으면 가장 적은 오행이 결핍이고 absent는 비어 있다", () => {
    const p = elementProfile(counts(1, 3, 2, 1, 1), "화");
    expect(p.absent).toEqual([]);
    expect(p.lacking).toBe("목"); // 1개 동률 → 일간(화)을 생하는 목 우선
  });

  it("결핍 동률이면 일간을 생하는 오행을 고른다", () => {
    // 일간 수 → 수를 생하는 금이 후보에 있으므로 금
    const p = elementProfile(counts(0, 4, 4, 0, 0), "수");
    expect(p.lacking).toBe("금");
  });

  it("결핍 동률에 생아 오행이 없으면 목화토금수 순서로 정한다", () => {
    // 일간 수 → 생아는 금인데 금은 후보가 아님 → 후보(화, 토) 중 앞선 화
    const p = elementProfile(counts(4, 0, 0, 4, 0), "수");
    expect(p.lacking).toBe("화");
  });

  it("최다 동률은 목화토금수 순서로 정한다", () => {
    const p = elementProfile(counts(1, 3, 3, 1, 0), "목");
    expect(p.dominant).toBe("화");
  });

  it("최다와 최소 차이가 1 이하면 균형으로 본다", () => {
    const p = elementProfile(counts(2, 2, 2, 1, 1), "목");
    expect(p.isBalanced).toBe(true);
  });

  it("한 오행에 몰려 있어도 판정이 나온다", () => {
    const p = elementProfile(counts(8, 0, 0, 0, 0), "목");
    expect(p.dominant).toBe("목");
    expect(p.absent).toEqual(["화", "토", "금", "수"]);
    expect(p.lacking).toBe("수"); // 목을 생하는 수 우선
    expect(p.isBalanced).toBe(false);
  });
});

describe("profileElements — 원국에서 바로", () => {
  it("1990-05-15 14:30 → 금이 많고 목이 없다", () => {
    const chart = buildChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      gender: "male",
    });
    const p = profileElements(chart);
    expect(p.counts).toEqual({ 목: 0, 화: 2, 토: 2, 금: 3, 수: 1 });
    expect(p.total).toBe(8);
    expect(p.dominant).toBe("금");
    expect(p.lacking).toBe("목");
    expect(p.absent).toEqual(["목"]);
  });

  it("시주 없이 3주(6자)만으로도 판정한다 — 라이트 퍼널 경로", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, gender: "male" });
    const p = profileElements(chart);
    expect(p.total).toBe(6);
    expect(p.dominant).toBeDefined();
    expect(p.lacking).toBeDefined();
  });
});

describe("elementProfileCopy — 귀인지도 문구", () => {
  it("많고 적은 기운을 짚고, 귀한 기운을 말해 준다", () => {
    const copy = elementProfileCopy(elementProfile(counts(0, 2, 2, 3, 1), "금"));
    expect(copy.summary).toBe("금 기운이 많고 목 기운이 적은 구성이에요.");
    expect(copy.guiin).toBe("목 기운을 지닌 친구가 특히 귀해요.");
  });

  it("아예 없는 기운은 없다고 짚어 준다", () => {
    const copy = elementProfileCopy(elementProfile(counts(0, 2, 2, 3, 1), "금"));
    expect(copy.absentNote).toBe("목 기운은 원국에 한 글자도 없어요.");
  });

  it("없는 기운이 아니면 absentNote는 비운다", () => {
    const copy = elementProfileCopy(elementProfile(counts(1, 3, 2, 1, 1), "화"));
    expect(copy.absentNote).toBeNull();
  });

  it("균형 구성은 많다·적다로 단정하지 않는다", () => {
    const copy = elementProfileCopy(elementProfile(counts(2, 2, 2, 1, 1), "목"));
    expect(copy.summary).toBe("오행이 고르게 퍼져 있는 구성이에요.");
    // 금·수가 1개로 동률 → 일간(목)을 생하는 수 우선
    expect(copy.guiin).toBe("수 기운을 지닌 친구가 특히 귀해요.");
  });

  it("문구는 모두 해요체로 끝난다", () => {
    const copy = elementProfileCopy(elementProfile(counts(0, 4, 0, 3, 1), "화"));
    expect(copy.summary).toMatch(/요\.$/);
    expect(copy.guiin).toMatch(/요\.$/);
    expect(copy.absentNote).toMatch(/요\.$/);
  });
});

describe("전수 — 8자·6자로 가능한 모든 분포", () => {
  const ORDER: Element[] = ["목", "화", "토", "금", "수"];

  /** 합이 total인 5칸 분포를 모두 만든다 */
  function allDistributions(total: number): Record<Element, number>[] {
    const out: Record<Element, number>[] = [];
    for (let a = 0; a <= total; a++)
      for (let b = 0; b <= total - a; b++)
        for (let c = 0; c <= total - a - b; c++)
          for (let d = 0; d <= total - a - b - c; d++)
            out.push(counts(a, b, c, d, total - a - b - c - d));
    return out;
  }

  const cases = [...allDistributions(8), ...allDistributions(6)];

  it("가능한 분포 수가 예상과 맞는다 (8자 495 + 6자 210)", () => {
    expect(cases).toHaveLength(705);
  });

  it("모든 분포·모든 일간에서 판정이 규칙을 지킨다", () => {
    for (const c of cases) {
      for (const dayMaster of ORDER) {
        const v = elementProfile(c, dayMaster);
        const values = ORDER.map((el) => c[el]);
        const max = Math.max(...values);
        const min = Math.min(...values);

        expect(c[v.dominant]).toBe(max);
        expect(c[v.lacking]).toBe(min);
        expect(v.absent).toEqual(ORDER.filter((el) => c[el] === 0));
        expect(v.isBalanced).toBe(max - min <= 1);
        // 0개인 오행이 있으면 결핍은 반드시 그중 하나다
        if (v.absent.length > 0) expect(v.absent).toContain(v.lacking);
        // 결핍 후보에 생아 오행이 있으면 그걸 고른다
        const supporter = generatedBy(dayMaster);
        if (c[supporter] === min) expect(v.lacking).toBe(supporter);
      }
    }
  });

  it("모든 분포에서 문구가 비지 않고 해요체로 끝난다", () => {
    for (const c of cases) {
      for (const dayMaster of ORDER) {
        const copy = elementProfileCopy(elementProfile(c, dayMaster));
        expect(copy.summary).toMatch(/요\.$/);
        expect(copy.guiin).toMatch(/요\.$/);
        if (copy.absentNote !== null) expect(copy.absentNote).toMatch(/요\.$/);
      }
    }
  });
});
