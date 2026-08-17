import { getSession } from "@/lib/auth/session";
import { getProfile, listProfiles } from "@/lib/profiles/store";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import { advanceConsultation, ConsultationClosedError } from "@/lib/consultations/service";
import { getConsultation } from "@/lib/consultations/store";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다. 형식을 먼저 본다.
  if (!/^[1-9]\d*$/.test(id)) {
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

  // 프로필이 지워졌으면 그 계정의 첫 프로필로 이어간다. 남은 이력은 살아 있고,
  // 근거만 현재 프로필에서 다시 세운다.
  const profile =
    (consultation.profileId
      ? await getProfile(session.userId, consultation.profileId)
      : null) ?? (await listProfiles(session.userId))[0];

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
    console.error("[POST /api/consultations/:id/messages]", e);
    return Response.json({ error: "답변을 받지 못했어요" }, { status: 500 });
  }
}
