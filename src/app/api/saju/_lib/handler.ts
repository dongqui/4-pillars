import { analyze } from "@/lib/saju-core";
import { parseRequest, ValidationError } from "./input";
import { chartKey, pillarsJson } from "./key";
import { getCached, putCached } from "./store";
import type { InterpretationGenerator, SajuResponse } from "./types";

export interface HandlerDeps {
  generator: InterpretationGenerator;
  getCached: typeof getCached;
  putCached: typeof putCached;
}

export interface HandlerResult {
  status: number;
  body: SajuResponse | { error: string };
}

export async function handleSaju(raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  // 1. 입력 검증
  let parsed;
  try {
    parsed = parseRequest(raw);
  } catch (e) {
    if (e instanceof ValidationError) return { status: 400, body: { error: e.message } };
    throw e;
  }

  // 2. 만세력 계산 (결정적)
  let analysis;
  try {
    analysis = analyze(parsed.input);
  } catch (e) {
    return { status: 422, body: { error: (e as Error).message } };
  }

  // 3. 캐시 조회 (DB 오류는 상위로 전파 → 500)
  const key = chartKey(analysis.chart);
  const cached = await deps.getCached(key);
  if (cached) {
    return {
      status: 200,
      body: { name: parsed.name, analysis, interpretation: cached, cached: true },
    };
  }

  // 4. 캐시 miss → 생성
  let interpretation;
  try {
    interpretation = await deps.generator.generate(analysis);
  } catch {
    return { status: 502, body: { error: "해석 생성에 실패했습니다" } };
  }

  // 5. 저장 (멱등)
  await deps.putCached({
    chartKey: key,
    gender: analysis.chart.gender,
    pillars: pillarsJson(analysis.chart),
    interpretation,
    model: deps.generator.model,
  });

  return {
    status: 200,
    body: { name: parsed.name, analysis, interpretation, cached: false },
  };
}
