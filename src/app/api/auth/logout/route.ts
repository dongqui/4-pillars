import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { DRAFT_COOKIE, deleteDraft } from "@/lib/drafts/store";

export async function POST(req: NextRequest) {
  // 303: 폼 POST 를 GET 으로 바꿔 랜딩을 열게 한다 (기본값 307 은 POST 를 다시 보낸다).
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);

  // 공유 브라우저에서 로그인 전에 남긴 드래프트가 다음 로그인 사용자에게 승격되지 않게
  // 정리한다. Redis 삭제가 실패해도 로그아웃은 성공해야 한다 — promoteDraft 와 같은 이유로
  // try/catch 로 감싸고 로그만 남긴다.
  const token = req.cookies.get(DRAFT_COOKIE)?.value;
  res.cookies.delete(DRAFT_COOKIE);
  if (token) {
    try {
      await deleteDraft(token);
    } catch (e) {
      console.error("[logout] deleteDraft", e instanceof Error ? e.message : e);
    }
  }

  return res;
}
