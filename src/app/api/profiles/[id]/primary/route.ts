import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { setPrimaryProfile } from "@/lib/auth/users";
import { handleSetPrimary } from "./_lib/handler";

// 본문이 없는 요청이라 형제 DELETE 라우트처럼 body-parse 단계를 두지 않는다.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  try {
    const result = await handleSetPrimary(id, {
      userId: session?.userId ?? null,
      setPrimary: setPrimaryProfile,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/profiles/:id/primary]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
