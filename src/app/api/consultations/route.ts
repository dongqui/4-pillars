import { getSession } from "@/lib/auth/session";
import { getProfile, listProfiles } from "@/lib/profiles/store";
import { parseProfileParam } from "@/lib/profiles/param";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import { openConsultation } from "@/lib/consultations/service";
import { listConsultations } from "@/lib/consultations/store";
import { InsufficientTicketsError } from "@/lib/consultations/ticket-port";

/** 첫 턴이 LLM 한 번이라 리포트만큼 오래 걸리지는 않지만, pro 모델이라 여유를 둔다 */
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const rows = await listConsultations(session.userId);
  return Response.json({ consultations: rows });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const body = utteranceSchema.safeParse(raw);
  if (!body.success) {
    return Response.json({ error: "질문을 1자 이상 1000자 이하로 입력해 주세요" }, { status: 400 });
  }

  // ?profile 은 홈 카드가 넘기는 값이다. 없거나 남의 것이면 그 계정의 첫 프로필로
  // 물러선다 — 상담을 못 여는 것보다 낫고, getProfile 이 user_id 로 함께 걸러
  // 남의 프로필은 애초에 잡히지 않는다.
  const param = parseProfileParam(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  // getProfile 은 kind 를 가리지 않으므로 궁합 상대("other")도 잡힌다. 상담은 자기
  // 사주를 놓고 하는 것이고 상담사는 프로필 주인에게 말한다 — 상대 프로필로 열면
  // 상담사가 남의 원국을 근거로 나에게 말하는 화면이 된다. self 가 아니면 물러선다.
  const picked = param.kind === "id" ? await getProfile(session.userId, param.id) : null;
  const profile =
    picked?.kind === "self"
      ? picked
      : (await listProfiles(session.userId, "self"))[0];

  if (!profile) {
    return Response.json({ error: "먼저 사주 정보를 입력해 주세요" }, { status: 409 });
  }

  const facts = factsForProfile(profile);
  if (!facts) {
    return Response.json({ error: "이 생년월일로는 상담을 열 수 없어요" }, { status: 422 });
  }

  try {
    const result = await openConsultation(
      {
        userId: session.userId,
        profileId: profile.id,
        facts,
        utterance: body.data.text,
      },
      consultationDeps(),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof InsufficientTicketsError) {
      return Response.json({ error: "이용권이 부족해요" }, { status: 402 });
    }
    console.error("[POST /api/consultations]", e);
    return Response.json({ error: "상담을 시작하지 못했어요" }, { status: 500 });
  }
}
