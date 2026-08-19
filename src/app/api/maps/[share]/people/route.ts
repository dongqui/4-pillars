import { NextResponse, type NextRequest } from "next/server";
import { addMapPerson, getMapByShareId } from "@/lib/maps/store";
import { handleAddPerson } from "../../_lib/handler";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ share: string }> },
): Promise<NextResponse> {
  const { share } = await ctx.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  try {
    const result = await handleAddPerson(raw, {
      findMap: () => getMapByShareId(share),
      add: addMapPerson,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/maps/[share]/people]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
