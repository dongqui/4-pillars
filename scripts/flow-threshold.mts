// FLOW_SEGMENT_THRESHOLD 를 고르기 위한 분포 측정.
//
// 눈대중으로 고른 상수는 나중에 아무도 못 고친다(synastry.ts:70). 값의 근거를
// 분포로 남기려고 둔다. 실행: npx tsx scripts/flow-threshold.mts

import { analyze } from "@/lib/saju-core/analyze";
import { flowSegments } from "@/app/api/flows/_lib/segments";

const YEARS = [2025, 2026, 2027];
const BIRTHS: { year: number; month: number; day: number }[] = [];
for (let y = 1960; y <= 2005; y += 5) {
  for (const [m, d] of [[2, 10], [5, 22], [8, 3], [11, 17]] as const) {
    BIRTHS.push({ year: y, month: m, day: d });
  }
}

const counts = new Map<number, number>();
for (const b of BIRTHS) {
  for (const g of ["male", "female"] as const) {
    const a = analyze({ ...b, hour: 9, minute: 0, gender: g, calendar: "solar" });
    for (const y of YEARS) {
      const n = flowSegments(a, y).length;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
}

const total = [...counts.values()].reduce((x, y) => x + y, 0);
for (const n of [1, 2, 3]) {
  const c = counts.get(n) ?? 0;
  console.log(`${n}구간: ${c}건 (${((c / total) * 100).toFixed(1)}%)`);
}
