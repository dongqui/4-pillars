import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canCreateMatch } from "@/lib/matches/access";
import { findOrCreateMatch } from "@/lib/matches/store";
import { createProfile, getProfile } from "@/lib/profiles/store";
import { handleCreateMatch } from "./_lib/handler";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateMatch(raw, {
      userId: session?.userId ?? null,
      checkAccess: canCreateMatch,
      getProfile,
      createProfile,
      findOrCreate: findOrCreateMatch,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/matches]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
