import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteMapPerson, getMapByShareId } from "@/lib/maps/store";
import { handleDeletePerson } from "../../../_lib/handler";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ share: string; id: string }> },
): Promise<NextResponse> {
  const { share, id } = await ctx.params;

  // ::bigint 캐스팅에서 DB 에러가 나지 않도록 형식을 먼저 본다
  // (profiles/param.ts 가 같은 이유로 존재한다).
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleDeletePerson({
      findMap: () => getMapByShareId(share),
      userId: session?.userId ?? null,
      personId: id,
      remove: deleteMapPerson,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[DELETE /api/maps/[share]/people/[id]]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
