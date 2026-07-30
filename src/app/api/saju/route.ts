import { handleSaju } from "./_lib/handler";
import { createGenerator } from "./_lib/generator";
import { getCached, putCached } from "./_lib/store";
import { getLuckCached, putLuckSections } from "./_lib/store-luck";
import { FREE_SECTION_KEYS } from "./_lib/sections";
import type { ErrorResponse, InterpretationGenerator } from "./_lib/types";

/**
 * 캐시 미스면 섹션마다 LLM 을 병렬로 부른다 — 무료 5섹션 기준 10초 안팎이라
 * 기본 타임아웃에 걸리면 요청이 통째로 죽는다. 유료 섹션(daeunOutlook 이 가장
 * 느리다)까지 열면 이 값을 다시 본다.
 */
export const maxDuration = 60;

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let cached: InterpretationGenerator | undefined;
const generator = (): InterpretationGenerator => (cached ??= createGenerator());

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "요청 본문이 유효한 JSON이 아닙니다" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  try {
    const result = await handleSaju(raw, {
      generator: generator(),
      getCached,
      putCached,
      getLuckCached,
      putLuckSections,
      // 결제 연동 전까지는 무료 범위만. 유료 키를 언제 넓힐지는 별도 작업이다.
      sectionKeys: FREE_SECTION_KEYS,
      year: new Date().getFullYear(),
    });
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/saju]", e);
    return Response.json(
      { error: "서버 오류가 발생했습니다" } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
