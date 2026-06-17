// 만세력 + 분석 엔진 데모
//   pnpm --filter @4-pillars/saju-core demo
//   pnpm --filter @4-pillars/saju-core demo -- 1990 5 15 14 30 male

import { analyze, type BirthInput } from "./index.js";

function parseArgs(): BirthInput {
  const a = process.argv.slice(2);
  if (a.length === 0) {
    return { year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" };
  }
  const [y, m, d, h, min, g] = a;
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: h !== undefined ? Number(h) : undefined,
    minute: min !== undefined ? Number(min) : 0,
    gender: g === "female" ? "female" : "male",
  };
}

function bar(pct: number): string {
  return "█".repeat(Math.round(pct / 5));
}

const input = parseArgs();
const a = analyze(input);
const { chart, elements, tenGods, strength, yongsin, daeun } = a;

const line = "─".repeat(48);
console.log(line);
console.log(
  `입력: ${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")} ` +
    `${input.hour ?? "--"}:${String(input.minute ?? 0).padStart(2, "0")} ` +
    `${input.gender === "male" ? "남" : "여"} (${input.calendar ?? "solar"})`,
);
console.log(line);

console.log("【원국】 일간:", chart.dayMaster);
console.log(
  `  년주 ${chart.year.korean}(${chart.year.hanja})  월주 ${chart.month.korean}(${chart.month.hanja})`,
);
console.log(
  `  일주 ${chart.day.korean}(${chart.day.hanja})  시주 ${chart.hour ? `${chart.hour.korean}(${chart.hour.hanja})` : "(시간 미상)"}`,
);

console.log("\n【오행 분포】", `총 ${elements.total}자`);
for (const el of ["목", "화", "토", "금", "수"] as const) {
  console.log(
    `  ${el}  ${String(elements.counts[el]).padStart(2)}개  ${String(elements.percentages[el]).padStart(5)}%  ${bar(elements.percentages[el])}`,
  );
}

console.log("\n【십성 분포】");
console.log(
  "  " +
    (Object.entries(tenGods.distribution) as [string, number][])
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}${n}`)
      .join("  "),
);
console.log(
  "  세력: " +
    (Object.entries(tenGods.groupDistribution) as [string, number][])
      .map(([k, n]) => `${k}${n}`)
      .join("  "),
);

console.log("\n【신강/신약】", strength.level);
console.log(
  `  우호(비겁+인성) ${strength.supportive} vs 비우호(식상+재성+관성) ${strength.draining}` +
    `  → 비율 ${(strength.ratio * 100).toFixed(1)}%`,
);

console.log("\n【용신/희신】", `(${yongsin.method})`);
console.log(`  용신 ${yongsin.yongsin}  희신 ${yongsin.huisin}  — ${yongsin.reason}`);

console.log(
  `\n【대운】 ${daeun.direction}  대운수 ${daeun.daeunSu}세 (기준 ${daeun.basisTerm}, ${daeun.daysToTerm.toFixed(1)}일)`,
);
console.log(
  "  " + daeun.periods.map((p) => `${String(p.startAge).padStart(2)}세 ${p.pillar}`).join("  "),
);
console.log(line);
