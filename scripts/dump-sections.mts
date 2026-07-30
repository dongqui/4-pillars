// 실제 LLM 으로 전 섹션을 돌려 한 파일에 덤프한다. 판단 대상은 셋이다:
// 문체(해요체·숫자 금지·emphasis 부분 문자열), 스키마 유실률, 섹션 간 반복.
//
// PromptedGenerator 를 쓰지 않고 직접 루프를 돈다 — 그쪽은 실패를 warn 으로
// 삼켜서 "왜 떨어졌는지"가 안 남는다. 여기서는 그 이유가 결과물이다.
//
//   npm run dump -- --model deepseek-v4-pro --date 1990-10-25 --gender male --hour 14

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
// 배럴(`.../sections`, `.../prompt`)이 아니라 구체 파일에서 가져온다 — tsx 의
// ESM 로더가 `export *` 체인 너머의 이름을 못 찾아 SyntaxError 를 낸다.
import { analyze } from "@/lib/saju-core/analyze";
import type { BirthInput } from "@/lib/saju-core/chart";
import { createDeepSeekTransport } from "@/app/api/saju/_lib/deepseek";
import { buildSectionRequest } from "@/app/api/saju/_lib/prompt/index";
import {
  SECTION_KEYS,
  parseSectionContent,
  type SectionKey,
} from "@/app/api/saju/_lib/sections/derive";

const apiKey = process.env.DEEP_SEEK_API_KEY;
if (!apiKey) {
  throw new Error("DEEP_SEEK_API_KEY 가 없습니다. `--env-file=.env.local` 로 실행하세요.");
}

// --- 인자 ---
const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const model = arg("model", "deepseek-v4-flash")!;
const date = arg("date", "1990-10-25")!;
const gender = arg("gender", "male") as "male" | "female";
const hourArg = arg("hour");
const year = Number(arg("year", String(new Date().getFullYear())));
// 켜면 tool 강제가 auto 로 내려간다. 문체가 나아지는 대신 섹션 유실이 늘어나는지 보는 스위치.
const thinking = process.argv.includes("--thinking");

const [y, m, d] = date.split("-").map(Number);
const input: BirthInput = {
  year: y,
  month: m,
  day: d,
  gender,
  ...(hourArg ? { hour: Number(hourArg) } : {}),
};

const analysis = analyze(input);

// --- 실행 ---
interface Usage {
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
}

const usageByKey = new Map<string, Usage>();
const transport = createDeepSeekTransport({
  apiKey,
  model,
  thinking,
  onUsage: (key, u) => usageByKey.set(key, (u ?? {}) as Usage),
});

interface Row {
  key: SectionKey;
  ms: number;
  raw?: unknown;
  /** 스키마 검증 통과 여부. false 면 응답은 왔지만 shape 이 틀린 것. */
  valid: boolean;
  error?: string;
}

const label = `${model}${thinking ? " +thinking" : ""}`;
console.log(`${label} · ${date} ${gender}${hourArg ? ` ${hourArg}시` : " (시주 없음)"} · ${SECTION_KEYS.length}개 섹션`);

const started = Date.now();
const rows: Row[] = await Promise.all(
  SECTION_KEYS.map(async (key): Promise<Row> => {
    const t0 = Date.now();
    try {
      const wrapped = await transport(buildSectionRequest(analysis, key, { year }));
      const ms = Date.now() - t0;
      const content =
        typeof wrapped === "object" && wrapped !== null && "content" in wrapped
          ? (wrapped as { content: unknown }).content
          : undefined;
      // handleSaju 와 같은 검증을 건다. 여기서 떨어지면 실서비스에서도 떨어진다.
      const valid = content !== undefined && parseSectionContent(key, content) !== null;
      console.log(`  ${valid ? "OK  " : "FAIL"} ${key} (${ms}ms)`);
      return { key, ms, raw: content, valid };
    } catch (e) {
      const ms = Date.now() - t0;
      const error = e instanceof Error ? e.message : String(e);
      console.log(`  ERR  ${key} (${ms}ms) — ${error}`);
      return { key, ms, valid: false, error };
    }
  }),
);
const totalMs = Date.now() - started;

// --- 집계 ---
const sum = (pick: (u: Usage) => number | undefined) =>
  [...usageByKey.values()].reduce((n, u) => n + (pick(u) ?? 0), 0);

const hit = sum((u) => u.prompt_cache_hit_tokens);
const miss = sum((u) => u.prompt_cache_miss_tokens);
const out = sum((u) => u.completion_tokens);

// 2026-07 기준 단가 (USD / 1M tokens)
const RATES: Record<string, { hit: number; miss: number; out: number }> = {
  "deepseek-v4-flash": { hit: 0.0028, miss: 0.14, out: 0.28 },
  "deepseek-v4-pro": { hit: 0.003625, miss: 0.435, out: 0.87 },
};
const rate = RATES[model];
const cost = rate
  ? (hit * rate.hit + miss * rate.miss + out * rate.out) / 1_000_000
  : null;

const ok = rows.filter((r) => r.valid);
const summary = [
  `- 성공 ${ok.length}/${rows.length}`,
  `- 총 소요 ${(totalMs / 1000).toFixed(1)}s (병렬)`,
  `- 입력 캐시히트 ${hit} / 캐시미스 ${miss} · 출력 ${out}`,
  cost === null ? `- 비용: ${model} 단가 미등록` : `- 비용 $${cost.toFixed(5)}`,
];
console.log("\n" + summary.join("\n"));

// --- 덤프 ---
const body = rows.map((r) => {
  const u = usageByKey.get(r.key);
  const meta = [
    `- 검증: ${r.valid ? "통과" : "**실패**"}`,
    `- ${r.ms}ms`,
    u ? `- 캐시히트 ${u.prompt_cache_hit_tokens ?? 0} / 미스 ${u.prompt_cache_miss_tokens ?? 0} · 출력 ${u.completion_tokens ?? 0}` : null,
    r.error ? `- 오류: \`${r.error}\`` : null,
  ].filter(Boolean).join("\n");

  return [
    `## ${r.key}`,
    "",
    meta,
    "",
    r.raw === undefined ? "_(응답 없음)_" : "```json\n" + JSON.stringify(r.raw, null, 2) + "\n```",
  ].join("\n");
});

const stamp = new Date().toISOString().slice(0, 10);
const dir = join(process.cwd(), "docs/superpowers/outputs");
await mkdir(dir, { recursive: true });
const slug = `${model}${thinking ? "-thinking" : ""}`;
const file = join(dir, `${stamp}-${slug}-${date}-${gender}.md`);

await writeFile(
  file,
  [
    `# ${label} 전 섹션 출력 — ${date} ${gender}${hourArg ? ` ${hourArg}시` : " (시주 미입력)"}`,
    "",
    `- 기준 연도: ${year}`,
    ...summary,
    "",
    "> 볼 것: ① 해요체·숫자 금지가 지켜지는가 ② emphasis 가 summary 의 부분 문자열인가",
    "> (wealth·daeunOutlook) ③ 섹션끼리 같은 표현을 반복하는가",
    "",
    ...body,
  ].join("\n"),
  "utf8",
);

console.log(`\n→ ${file}`);
