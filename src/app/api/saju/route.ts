import { handleSaju } from "./_lib/handler";
import { StubGenerator } from "./_lib/generate";
import { getCached, putCached } from "./_lib/store";
import { getLuckCached, putLuckSections } from "./_lib/store-luck";
import { FREE_SECTION_KEYS } from "./_lib/sections";
import type { ErrorResponse } from "./_lib/types";

const generator = new StubGenerator();

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
      generator,
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
