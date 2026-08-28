import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canCreateFlow } from "@/lib/flows/access";
import { findOrCreateFlow } from "@/lib/flows/store";
import { getProfile } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { handleCreateFlow } from "./_lib/handler";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateFlow(raw, {
      userId: session?.userId ?? null,
      now: new Date(),
      checkAccess: canCreateFlow,
      // @/lib/profiles/store 의 getProfile 은 ProfileRow(이름·달력·시각 앎 여부 등
      // DB 컬럼 전부)를 돌려준다 — handler 가 기대하는 {id, birth: BirthInput} 과
      // 모양이 다르다. handler 를 store 를 모르는 순수한 채로 두려고 어댑팅을
      // 여기서 한다. toBirthInput 은 consultations/facts.ts 가 쓰는 것과 같은
      // 변환기라 생년월일 필드 매핑이 이미 검증돼 있다.
      getProfile: async (userId, id) => {
        const row = await getProfile(userId, id);
        return row ? { id: row.id, birth: toBirthInput(row) } : null;
      },
      findOrCreate: findOrCreateFlow,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/flows]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
