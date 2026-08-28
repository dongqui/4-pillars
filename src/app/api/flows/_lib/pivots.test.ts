import { describe, expect, it } from "vitest";
import { analyze, type BirthInput } from "@/lib/saju-core";
import {
  MAX_PIVOTS,
  MIN_PIVOT_GAP_MONTHS,
  PIVOT_THRESHOLD,
  effectiveDeltas,
  flowMonths,
} from "./pivots";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

const YEARS = [2021, 2024, 2026, 2027, 2029, 2031];

// 간격 충돌이 실제로 걸리는지 확인하려고 서로 다른 프로필 여럿을 쓴다 — 프로필
// 하나로는 충돌이 몇 번 안 걸려서 "쌍(pairwise) 관계가 지켜지는가" 를 제대로
// 시험하지 못한다. 시간 미상 프로필(4번째)도 하나 섞는다.
const PIVOT_BIRTHS: BirthInput[] = [
  BIRTH,
  { ...BIRTH, gender: "female" },
  { ...BIRTH, hour: undefined, minute: undefined },
  { year: 1985, month: 6, day: 20, hour: 15, minute: 0, gender: "female", calendar: "solar" },
  { year: 1978, month: 11, day: 3, hour: 9, minute: 20, gender: "male", calendar: "solar" },
  { year: 2001, month: 2, day: 28, hour: 3, minute: 0, gender: "female", calendar: "solar" },
];

describe("flowMonths", () => {
  it("언제나 12개를 낸다", () => {
    for (const y of YEARS) expect(flowMonths(analyze(BIRTH), y)).toHaveLength(12);
  });

  it("index 는 1‥12, 경계는 틈 없이 이어진다", () => {
    const months = flowMonths(analyze(BIRTH), 2027);
    expect(months.map((m) => m.index)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i].start).toBe(months[i - 1].end);
    }
  });

  it("첫 달은 절대 변곡점이 아니다", () => {
    // 세운이 입춘에 바뀌므로 첫 달의 Δ 는 거의 항상 크다. 넣으면 매년
    // 변곡점이 되어 신호가 아니라 상수가 된다. 그리고 그 이야기는 01 이 한다.
    for (const y of YEARS) {
      expect(flowMonths(analyze(BIRTH), y)[0].pivot).toBe(false);
    }
  });

  it("변곡점은 MAX_PIVOTS 개를 넘지 않는다", () => {
    for (const y of YEARS) {
      const n = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).length;
      expect(n).toBeLessThanOrEqual(MAX_PIVOTS);
    }
  });

  it("변곡점끼리 MIN_PIVOT_GAP_MONTHS 보다 가깝지 않다", () => {
    for (const y of YEARS) {
      const picked = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).map((m) => m.index);
      for (let i = 1; i < picked.length; i += 1) {
        expect(picked[i] - picked[i - 1]).toBeGreaterThanOrEqual(MIN_PIVOT_GAP_MONTHS);
      }
    }
  });

  it("같은 입력이면 같은 변곡점이 나온다", () => {
    const a = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    const b = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    expect(a).toEqual(b);
  });

  /**
   * 선정 루프는 `picked.length === MAX_PIVOTS` 가 되는 순간 즉시 break 한다 —
   * 그 뒤에 남은 후보는 tooClose 판정을 아예 받아본 적이 없다. 배제 원인이
   * "간격" 이 아니라 "정원 마감" 인 후보는 쌍(pairwise) 보장의 대상이 아니다.
   *
   * 어느 후보가 그쪽인지는 Δ 크기로 어림하지 않고, 선정 루프와 같은 순서
   * (Δ 내림차순, 동점이면 index 오름차순)로 후보를 다시 늘어놓고 `picked` 원소를
   * 몇 번째에 만나는지 세어서 정확히 짚어낸다 — 이 순서 자체는 흔들리지 않는
   * 규칙이라 재현해도 선정 로직(tooClose)을 베끼는 게 아니다. MAX_PIVOTS 번째
   * `picked` 원소를 지난 자리부터는 전부 정원 마감 배제다.
   *
   * (Δ 크기 어림, 예를 들어 "선정된 것 중 최솟값보다 작은 후보는 정원 마감"
   * 은 후보 하나가 그 최솟값과 정확히 같을 때 어느 쪽인지 못 가른다 — 실측
   * 부동소수점에서는 안 나타나지만 증명은 안 된다. 그래서 이 방식을 쓴다.)
   */
  function capExcludedIndices(deltas: number[], picked: number[]): Set<number> {
    if (picked.length !== MAX_PIVOTS) return new Set(); // 정원이 안 찼으면 마감도 없다
    const pickedSet = new Set(picked);
    const order = Array.from({ length: 11 }, (_, i) => i + 2).sort(
      (a, b) => deltas[b - 1] - deltas[a - 1] || a - b,
    );
    let seen = 0;
    let capAt = -1;
    for (let pos = 0; pos < order.length; pos += 1) {
      if (pickedSet.has(order[pos])) {
        seen += 1;
        if (seen === MAX_PIVOTS) {
          capAt = pos;
          break;
        }
      }
    }
    const out = new Set<number>();
    for (let pos = capAt + 1; pos < order.length; pos += 1) {
      if (!pickedSet.has(order[pos])) out.add(order[pos]);
    }
    return out;
  }

  it("간격에 걸려 탈락한 후보는 그 자리를 막은 이웃의 Δ 가 더 크거나 같다", () => {
    // 알고리즘이 보장하는 것은 쌍(pairwise) 관계뿐이다 — 정원 마감이 아니라
    // 간격 때문에 탈락한 달이라면, MIN_PIVOT_GAP_MONTHS 안에 있으면서 Δ 가 그보다
    // 크거나 같은 "뽑힌" 달이 최소 하나는 있어야 한다. "뽑힌 쪽이 전역적으로
    // 항상 더 크다" 는 더 강한 주장은 성립하지 않는다 — 더 작은 Δ 라도 간격이
    // 벌어져 있으면 뽑힌다(예: 1985-06-20/여성/2028 — 4번째달 Δ0.879 로 뽑히고,
    // 5번째달 Δ0.871 은 4번째달과 너무 가까워 탈락하지만, 6번째달 Δ0.767 은
    // 4번째달과 간격이 벌어져 뽑힌다). 프로필 하나로는 충돌이 드물어서 여럿과
    // 넓은 연도 범위로 돌린다.
    let conflictsChecked = 0;
    for (const birth of PIVOT_BIRTHS) {
      const analysis = analyze(birth);
      for (let y = 2015; y <= 2035; y += 1) {
        const deltas = effectiveDeltas(analysis, y);
        const picked = flowMonths(analysis, y).filter((m) => m.pivot).map((m) => m.index);
        const capExcluded = capExcludedIndices(deltas, picked);

        for (let idx = 2; idx <= 12; idx += 1) {
          if (picked.includes(idx)) continue;
          const delta = deltas[idx - 1];
          if (delta < PIVOT_THRESHOLD) continue; // 애초에 후보가 아니었다
          if (capExcluded.has(idx)) continue; // 간격이 아니라 정원 때문에 탈락했다
          conflictsChecked += 1;
          const hasLargerNeighbour = picked.some(
            (p) => Math.abs(p - idx) < MIN_PIVOT_GAP_MONTHS && deltas[p - 1] >= delta,
          );
          expect(hasLargerNeighbour).toBe(true);
        }
      }
    }
    // 충돌이 한 번도 안 걸리면 이 테스트는 아무것도 확인하지 않은 것과 같다.
    expect(conflictsChecked).toBeGreaterThan(0);
  });

  it("시간 미상 프로필도 변곡점을 받을 수 있다", () => {
    // BirthInput.hour/minute 는 optional number 다(chart.ts) — "미상" 은 undefined
    // 로 표현하지 null 이 아니다. hasHour = input.hour !== undefined 판정이라
    // null 을 넣으면 오히려 "시간 있음" 취급된다.
    const noHour = analyze({ ...BIRTH, hour: undefined, minute: undefined });
    const anyPivot = [2024, 2025, 2026, 2027, 2028].some((y) =>
      flowMonths(noHour, y).some((m) => m.pivot),
    );
    expect(anyPivot).toBe(true);
  });
});
