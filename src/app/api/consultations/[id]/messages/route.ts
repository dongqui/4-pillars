import { getSession } from "@/lib/auth/session";
import { defaultConsultationSubject } from "@/lib/consultations/subject";
import { getProfileById } from "@/lib/profiles/store";
import { isSequentialId } from "@/lib/profiles/param";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import {
  advanceConsultation,
  ConsultationClosedError,
  ConsultationRaceError,
} from "@/lib/consultations/service";
import { getConsultation } from "@/lib/consultations/store";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다. 형식뿐 아니라
  // bigint 상한도 여기서 함께 본다(isSequentialId, param.ts) — 자릿수만 세면
  // 19자리 안에서도 상한을 넘는 값을 놓쳐 getConsultation 의 ::bigint 캐스팅이 넘친다.
  if (!isSequentialId(id)) {
    return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });
  }

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

  const consultation = await getConsultation(session.userId, id);
  if (!consultation) return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });

  // 지워진 프로필이어도 그 사람의 원국으로 이어간다 — 나눈 이력의 근거가
  // 중간에 다른 사람으로 바뀌면 안 된다. profile_id 가 NULL 인 옛 행(프로필이
  // 소프트 삭제 이전에 진짜 지워진 경우)만 계정의 "나" 로 물러선다.
  const profile =
    (consultation.profileId
      ? await getProfileById(session.userId, consultation.profileId)
      : null) ?? (await defaultConsultationSubject(session.userId));

  if (!profile) {
    return Response.json({ error: "먼저 사주 정보를 입력해 주세요" }, { status: 409 });
  }

  const facts = factsForProfile(profile);
  if (!facts) {
    return Response.json({ error: "이 생년월일로는 상담을 이어갈 수 없어요" }, { status: 422 });
  }

  try {
    const result = await advanceConsultation(
      { userId: session.userId, id, facts, utterance: body.data.text },
      consultationDeps(),
    );
    if (!result) return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });
    return Response.json(result);
  } catch (e) {
    if (e instanceof ConsultationClosedError) {
      return Response.json({ error: "이 상담은 이미 마무리됐어요" }, { status: 409 });
    }
    if (e instanceof ConsultationRaceError) {
      return Response.json(
        { error: "다른 곳에서 대화가 먼저 진행됐어요. 새로고침하고 다시 시도해 주세요." },
        { status: 409 },
      );
    }
    console.error("[POST /api/consultations/:id/messages]", e);
    return Response.json({ error: "답변을 받지 못했어요" }, { status: 500 });
  }
}
