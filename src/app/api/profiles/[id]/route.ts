import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteProfile } from "@/lib/profiles/store";
import { handleDeleteProfile } from "./_lib/handler";

// 본문이 없는 요청이라 promote 라우트처럼 body-parse 단계를 두지 않는다.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  try {
    const result = await handleDeleteProfile(id, {
      userId: session?.userId ?? null,
      remove: deleteProfile,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[DELETE /api/profiles/:id]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
