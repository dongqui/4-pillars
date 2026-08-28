// PIVOT_THRESHOLD 를 고르기 위한 분포 측정.
//
// 눈대중으로 고른 상수는 나중에 아무도 못 고친다(synastry.ts:70). 값의 근거를
// 분포로 남기려고 둔다. 실행: npx tsx scripts/flow-threshold.mts
//
// 앞선 측정(구간용, FLOW_SEGMENT_THRESHOLD)과 다른 점 넷:
//   1. 세는 것이 구간 수가 아니라 변곡점 수다 (0~4)
//   2. 표본에 시간 미상을 섞는다 — 시지가 없으면 friction 의 분모가 달라진다
//   3. 선정 로직을 재구현하지 않는다 — pivots.ts 가 내보내는 effectiveDeltas 와
//      selectPivots 를 그대로 불러 쓴다. 직접 흉내 낸 선정 로직은 프로덕션이
//      바뀌어도 조용히 낡고, 둘 다 틀려도 서로 맞다고 착각하게 만든다.
//   4. 0.01 간격으로 스윕한다 — PIVOT_THRESHOLD 의 채택 근거가 "1~3개 합의
//      전 구간 최댓값" 이라, 0.05 간격으로는 그 최댓값이 어느 t 에서 나오는지
//      이 스크립트로 확인할 수 없다. 표본 1,760건 × 141개 t 값은 수 초 내로
//      끝나서 간격을 좁힐 이유는 있어도 넓힐 이유는 없다.

import { analyze } from "@/lib/saju-core/analyze";
import { MAX_PIVOTS, effectiveDeltas, selectPivots } from "@/app/api/flows/_lib/pivots";

// 현재(2026) ±5 — 상품이 실제로 파는 연도 범위다.
const YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];

interface Sample {
  year: number;
  month: number;
  day: number;
  hour: number | undefined;
  minute: number | undefined;
}

const BIRTHS: Sample[] = [];
for (let y = 1960; y <= 2005; y += 5) {
  for (const [m, d] of [[2, 10], [5, 22], [8, 3], [11, 17]] as const) {
    BIRTHS.push({ year: y, month: m, day: d, hour: 9, minute: 0 });
    // 표본의 절반은 시간 미상 — analyze 는 "미상" 을 undefined 로 받는다(hour?:
    // number). null 을 넣으면 오히려 "시간 있음" 으로 읽혀 Task 2 가 고친 편향이
    // 다시 측정에서 사라진다.
    BIRTHS.push({ year: y, month: m, day: d, hour: undefined, minute: undefined });
  }
}

const allDeltas: number[][] = [];
for (const b of BIRTHS) {
  for (const g of ["male", "female"] as const) {
    const a = analyze({ ...b, gender: g, calendar: "solar" });
    for (const y of YEARS) allDeltas.push(effectiveDeltas(a, y));
  }
}

console.log(`표본 ${allDeltas.length}건 (시간 미상 절반 포함, ${YEARS[0]}~${YEARS[YEARS.length - 1]}년)\n`);
console.log("임계값 |   0개  |   1개  |   2개  |   3개  |   4개  | 1~3개 합");
console.log("-".repeat(66));

// t 를 반복마다 더해서 만들면(t += STEP) 부동소수점 오차가 누적돼, 13번째
// 반복의 t 가 라벨 그대로의 0.85 가 아니라 0.8500000000000002 가 되는 식으로
// 라벨과 실제로 비교한 값이 어긋난다. 정수 카운터에서 매번 새로 계산하고
// toFixed 로 십진 표현을 고정해 라벨과 계산값이 항상 같은 수를 가리키게 한다.
const START = 0.2;
const STEP = 0.01;
const STEP_COUNT = Math.round((1.6 - START) / STEP);

interface Row { t: number; counts: number[]; mid: number }
const rows: Row[] = [];

for (let i = 0; i <= STEP_COUNT; i += 1) {
  const t = Number((START + i * STEP).toFixed(2));
  const counts = [0, 0, 0, 0, 0];
  for (const d of allDeltas) {
    const n = Math.min(selectPivots(d, t).length, MAX_PIVOTS);
    counts[n] += 1;
  }
  const mid = ((counts[1] + counts[2] + counts[3]) / allDeltas.length) * 100;
  rows.push({ t, counts, mid });
}

const pct = (n: number) => ((n / allDeltas.length) * 100).toFixed(2).padStart(6);
for (const { t, counts, mid } of rows) {
  console.log(
    `${t.toFixed(2).padStart(6)} |${pct(counts[0])} |${pct(counts[1])} |` +
      `${pct(counts[2])} |${pct(counts[3])} |${pct(counts[4])} | ${mid.toFixed(2)}%`,
  );
}

// 채택 근거의 핵심 수치: 1~3개 합이 전 구간에서 가장 큰 t (조건 1), 그리고 그
// 지점 주변이 평평한지(조건 4 — 경계값이면 표본이 조금만 흔들려도 성질이
// 바뀐다는 우려가 여기엔 적용되지 않는다는 확인).
const best = rows.reduce((a, b) => (b.mid > a.mid ? b : a));
console.log(`\n1~3개 합 최댓값: t=${best.t.toFixed(2)} (${best.mid.toFixed(2)}%)`);

console.log("\n최댓값 주변 평탄성 (조건 4 확인용):");
for (const offset of [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1]) {
  const t = Number((best.t + offset).toFixed(2));
  const row = rows.find((r) => r.t === t);
  if (!row) continue;
  const diff = best.mid - row.mid;
  console.log(`  t=${t.toFixed(2)} → 1~3개 합 ${row.mid.toFixed(2)}% (최댓값 대비 -${diff.toFixed(2)}pp)`);
}
