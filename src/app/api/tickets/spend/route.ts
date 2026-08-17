import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseProfileParam } from "@/lib/profiles/param";
import { getProfile } from "@/lib/profiles/store";
import type { Feature } from "@/lib/tickets/features";
import { spendTicket } from "@/lib/tickets/spend";
import { handleSpend } from "./_lib/handler";

/**
 * feature 별 대상 소유 규칙.
 *
 * switch + never 로 쓰는 이유: FEATURE_IDS 에 서비스를 추가하면 여기서 컴파일이
 * 깨진다. 규칙을 빠뜨린 서비스가 조용히 통과하면 소유 확인 없이 차감된다.
 */
async function ownsSubject(
  userId: string,
  feature: Feature,
  subjectKey: string,
): Promise<boolean> {
  switch (feature) {
    case "full_report": {
      // 검증 없이 넘기면 ::bigint 캐스팅이 DB 에러로 터져 404 여야 할 것이 500 이 된다.
      const param = parseProfileParam({ profile: subjectKey });
      if (param.kind !== "id") return false;
      return (await getProfile(userId, param.id)) !== null;
    }
    case "compatibility":
      // 궁합 화면이 아직 없다. 열어 두면 소유 확인 규칙이 없는 채로 차감된다 — 닫는다.
      // 화면을 만들 때 pairKey 의 두 프로필을 각각 소유 확인하는 규칙으로 바꾼다.
      return false;
    default: {
      const exhaustive: never = feature;
      return exhaustive;
    }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleSpend(raw, {
      userId: session?.userId ?? null,
      ownsSubject,
      spend: (a) => spendTicket(a),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/tickets/spend]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
