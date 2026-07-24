import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
