import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { promoteProfileToSelf } from "@/lib/profiles/store";
import { handlePromote } from "./_lib/handler";

// 본문이 없는 요청이라 /api/matches, /api/profiles 처럼 body-parse 단계를
// 따로 두지 않는다 — 파싱할 것이 없다.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  try {
    const result = await handlePromote(id, {
      userId: session?.userId ?? null,
      promote: promoteProfileToSelf,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/profiles/:id/promote]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
