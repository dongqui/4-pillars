import { analyze } from "@/lib/saju-core";
import { parseRequest, ValidationError } from "./input";
import { GenerationError, produceSections, type ProduceDeps } from "./produce";
import type { ErrorResponse, SajuResponse } from "./types";

/** 생성에 필요한 것과 같다. 이름은 기존 호출부·테스트가 쓰던 것을 유지한다. */
export type HandlerDeps = ProduceDeps;

export interface HandlerResult {
  status: number;
  body: SajuResponse | ErrorResponse;
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
    console.error("[handleSaju] 원국 계산 실패", e);
    return { status: 422, body: { error: "생년월일시를 확인해 주세요" } };
  }

  // 3. 해석 확보. 생성 실패는 502 — 캐시된 일부가 있어도 API 는 부분 응답을 하지 않는다
  //    (화면과 달리 호출자가 무엇을 받을지 모른다). DB 오류는 전파해 500 이 된다.
  let produced;
  try {
    produced = await produceSections(analysis, deps);
  } catch (e) {
    if (e instanceof GenerationError) return { status: 502, body: { error: e.message } };
    throw e;
  }

  return {
    status: 200,
    body: {
      name: parsed.name,
      analysis,
      interpretation: produced.interpretation,
      cached: produced.cached,
    },
  };
}
