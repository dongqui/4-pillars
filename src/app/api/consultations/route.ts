import { getSession } from "@/lib/auth/session";
import { defaultConsultationSubject } from "@/lib/consultations/subject";
import { getProfile } from "@/lib/profiles/store";
import { parseProfileParam } from "@/lib/profiles/param";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import { openConsultation } from "@/lib/consultations/service";
import { listConsultations } from "@/lib/consultations/store";
import { InsufficientTicketsError } from "@/lib/consultations/ticket-port";

/** 첫 턴이 LLM 한 번이라 리포트만큼 오래 걸리지는 않지만, pro 모델이라 여유를 둔다 */
export const maxDuration = 60;

/**
 * 한 프로필의 상담 목록. 어느 프로필인지는 POST 와 같은 규칙으로 정한다 — ?profile 이
 * 저장한 사람이면 그 사람, 아니면 계정의 "나". 두 핸들러가 다른 사람을 고르면 방금
 * 연 상담이 목록에 안 보인다.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const param = parseProfileParam(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const picked = param.kind === "id" ? await getProfile(session.userId, param.id) : null;
  const profile =
    picked?.kind === "saved" ? picked : await defaultConsultationSubject(session.userId);

  // 프로필이 하나도 없는 계정은 상담을 가질 수 없다 — 빈 목록이지 오류가 아니다.
  if (!profile) return Response.json({ consultations: [] });

  const rows = await listConsultations(session.userId, profile.id);
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
  // getProfile 은 kind 를 가리지 않으므로 'temp' 도 잡힌다. 이번 궁합에만 쓰겠다고
  // 한 사람으로 상담을 열어 이력을 남길 수는 없다 — 그 행은 목록에서 이미 사라졌고,
  // 다음에 이어 갈 방법도 없다. 저장한 사람이 아니면 물러선다.
  const picked = param.kind === "id" ? await getProfile(session.userId, param.id) : null;
  const profile =
    picked?.kind === "saved" ? picked : await defaultConsultationSubject(session.userId);

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
