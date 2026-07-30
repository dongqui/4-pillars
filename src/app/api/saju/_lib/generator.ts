// 실제 LLM 생성기를 환경변수에서 조립한다. route.ts 가 이걸 한 줄로 쓰고,
// 테스트는 이 모듈을 목으로 갈아끼워 네트워크 없이 라우트를 돈다.

import { createDeepSeekTransport } from "./deepseek";
import { PromptedGenerator } from "./prompted";
import type { InterpretationGenerator } from "./types";

/**
 * DB 의 model 컬럼에 기록되는 값이다. 바꾸면 기존 행과 다른 모델의 서술이
 * 같은 캐시 키 아래 섞이므로, 바꿀 때는 섹션 version 도 함께 올릴지 검토한다.
 *
 * flash 가 아니라 pro 인 이유: flash 는 객체형 content 섹션에서 tool arguments 를
 * 깨진 JSON(꼬리 중괄호)이나 이중 인코딩된 문자열로 내놓아 12개 중 5개가
 * 스키마 검증에서 떨어졌다. pro 는 같은 입력에서 12/12 통과했다.
 * (docs/superpowers/outputs/2026-07-30-* 비교)
 */
export const MODEL = "deepseek-v4-pro";

export function createGenerator(
  env: Record<string, string | undefined> = process.env,
): InterpretationGenerator {
  const apiKey = env.DEEP_SEEK_API_KEY;
  // stub 으로 조용히 물러서지 않는다 — 자리표시자 문구가 그대로 사용자에게 나간다.
  if (!apiKey) {
    throw new Error("DEEP_SEEK_API_KEY 가 설정되지 않았습니다");
  }
  return new PromptedGenerator(MODEL, createDeepSeekTransport({ apiKey, model: MODEL }));
}
