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
    case "consultation":
      // 이 둘은 HTTP 로 차감되지 않는다. 궁합은 /match/[id] 렌더 중 생성기 안에서,
      // 상담은 POST /api/consultations 처리 중 openConsultation 안에서 차감된다 —
      // 둘 다 서버 내부 경로라 이 엔드포인트를 지난 적이 없다.
      //
      // 소유 확인이 없는 것이 아니라 다른 곳에서 이미 한다: findOrCreateMatch 와
      // createConsultation 이 user_id 로 행을 만들고 조회한다. 여기를 열면 그
      // 확인을 우회하는 두 번째 문이 생긴다.
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
