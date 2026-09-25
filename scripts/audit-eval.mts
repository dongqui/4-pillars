// 근거 검사기 실험 하네스.
//
//   pnpm tsx --env-file=.env.local scripts/audit-eval.mts [tuned|holdout|all]
//
// 저장된 답변(scripts/audit-fixtures.json)을 다시 먹여 검사기만 시험한다. 상담
// 답변을 새로 만들지 않는다 — 생성 프롬프트와 해석 기준을 고정해야 검사기 때문에
// 달라진 것을 구분할 수 있다.
//
// 세는 법: 알려진 위반을 놓친 것(미탐), 정상을 위반이라 한 것(오탐), 판단보류,
// 검사 실패를 따로 센다. 보류와 실패는 통과로 세지 않는다.

import { readFileSync } from "node:fs";
import { runAudit } from "@/lib/consultations/audit";
import { TEST_CHART_CRITERIA, renderCriteria } from "@/lib/consultations/criteria";
import { createDeepSeekChatTransport } from "@/lib/consultations/chat-transport";
import { CONSULT_MODEL } from "@/lib/consultations/model";

interface Fixture {
  id: string;
  set: "tuned" | "holdout";
  expect: "위반" | "허용";
  expectNote: string;
  question: string;
  context?: string;
  basis: { criterionId: string; claim: string }[];
  bubbles: string[];
}

// DeepSeek 요금(2026-09 기준, 캐시 미스). 자릿수만 맞으면 되는 값이라 상수로 둔다.
const USD_PER_1M_IN = 0.28;
const USD_PER_1M_OUT = 0.42;

const { cases } = JSON.parse(readFileSync("scripts/audit-fixtures.json", "utf8")) as {
  cases: Fixture[];
};
const pick = process.argv[2] ?? "all";
const picked = cases.filter((c) => pick === "all" || c.set === pick);

const criteria = renderCriteria(TEST_CHART_CRITERIA);
const deps = {
  transport: createDeepSeekChatTransport({ apiKey: process.env.DEEP_SEEK_API_KEY! }),
  model: CONSULT_MODEL,
};

const rows = await Promise.all(
  picked.map(async (c) => {
    const t0 = Date.now();
    try {
      const { result, usage } = await runAudit(
        { question: c.question, context: c.context, criteria, basis: c.basis, bubbles: c.bubbles },
        deps,
      );
      return { c, result, usage, ms: Date.now() - t0, error: null as string | null };
    } catch (e) {
      return {
        c,
        result: null,
        usage: { promptTokens: 0, completionTokens: 0 },
        ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }),
);

let missed = 0;
let falseAlarm = 0;
let held = 0;
let failed = 0;
let hit = 0;
let ok = 0;

for (const { c, result, usage, ms, error } of rows) {
  const verdict = error ? "검사실패" : result!.verdict;
  let mark = "";
  if (error) {
    failed += 1;
    mark = "실패";
  } else if (verdict === "판단보류") {
    held += 1;
    mark = "보류";
  } else if (c.expect === "위반") {
    if (verdict === "위반") {
      hit += 1;
      mark = "잡음";
    } else {
      missed += 1;
      mark = "놓침!!";
    }
  } else if (verdict === "허용") {
    ok += 1;
    mark = "통과";
  } else {
    falseAlarm += 1;
    mark = "오탐!!";
  }

  console.log(
    `\n[${c.set}] ${c.id} — 기대 ${c.expect} / 판정 ${verdict} → ${mark} (${ms}ms, in ${usage.promptTokens} out ${usage.completionTokens})`,
  );
  console.log(`  기대 이유: ${c.expectNote}`);
  for (const f of result?.findings ?? []) {
    console.log(`  · [${f.kind}] ${f.criterionId || "(기준 없음)"} — ${f.why}`);
    console.log(`    "${f.sentence}"`);
  }
  if (error) console.log(`  오류: ${error}`);
}

const tokensIn = rows.reduce((n, r) => n + r.usage.promptTokens, 0);
const tokensOut = rows.reduce((n, r) => n + r.usage.completionTokens, 0);
const usd = (tokensIn / 1e6) * USD_PER_1M_IN + (tokensOut / 1e6) * USD_PER_1M_OUT;
const msAvg = Math.round(rows.reduce((n, r) => n + r.ms, 0) / rows.length);

console.log(
  `\n===== ${pick} ${rows.length}건 =====\n위반 잡음 ${hit} · 놓침 ${missed} · 정상 통과 ${ok} · 오탐 ${falseAlarm} · 보류 ${held} · 검사실패 ${failed}`,
);
console.log(
  `호출당 평균 ${msAvg}ms · 입력 ${Math.round(tokensIn / rows.length)}tok · 출력 ${Math.round(
    tokensOut / rows.length,
  )}tok · 1건당 약 $${(usd / rows.length).toFixed(5)} (1,000건 ≈ $${((usd / rows.length) * 1000).toFixed(2)})`,
);
