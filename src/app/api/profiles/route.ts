import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import {
  DRAFT_COOKIE,
  deleteDraft,
  draftCookieOptions,
  generateDraftToken,
  putDraft,
} from "@/lib/drafts/store";
import { handleCreateProfile } from "./_lib/handler";

// 반환 타입이 NextResponse 인 이유: Response 로 좁히면 쿠키를 굽지도, 테스트에서
// res.cookies 로 확인하지도 못한다.
export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateProfile(raw, {
      userId: session?.userId ?? null,
      create: createProfile,
      saveDraft: putDraft,
      newToken: generateDraftToken,
      existingToken: request.cookies.get(DRAFT_COOKIE)?.value ?? null,
      dropDraft: deleteDraft,
    });

    const res = NextResponse.json(result.body, { status: result.status });
    // 핸들러는 쿠키를 모른다 — 토큰만 받아 여기서 굽거나 지운다.
    if (result.draftToken) {
      res.cookies.set(DRAFT_COOKIE, result.draftToken, draftCookieOptions());
    }
    if (result.clearDraftCookie) {
      res.cookies.delete(DRAFT_COOKIE);
    }
    return res;
  } catch (e) {
    console.error("[POST /api/profiles]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
