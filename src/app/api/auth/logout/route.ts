import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  // 303: 폼 POST 를 GET 으로 바꿔 랜딩을 열게 한다 (기본값 307 은 POST 를 다시 보낸다).
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
