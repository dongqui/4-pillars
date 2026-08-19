import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteMapPerson, getMapByShareId } from "@/lib/maps/store";
import { isSequentialId } from "@/lib/profiles/param";
import { handleDeletePerson } from "../../../_lib/handler";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ share: string; id: string }> },
): Promise<NextResponse> {
  const { share, id } = await ctx.params;

  // ::bigint 캐스팅에서 DB 에러가 나지 않도록 형식을 먼저 본다. 자릿수만 세는
  // 정규식은 bigint 상한을 넘는 값(예: 9999...9999, 20자리)을 못 거르므로
  // profiles/param.ts 의 isSequentialId 를 그대로 쓴다 — 규칙을 두 번 손으로
  // 베끼면 한쪽만 고쳐질 때 이 클래스의 버그가 되돌아온다.
  if (!isSequentialId(id)) {
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
