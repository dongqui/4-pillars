import { handleSaju } from "./_lib/handler";
import { StubGenerator } from "./_lib/generate";
import { getCached, putCached } from "./_lib/store";

const generator = new StubGenerator();

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  try {
    const result = await handleSaju(raw, { generator, getCached, putCached });
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/saju]", e);
    return Response.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
