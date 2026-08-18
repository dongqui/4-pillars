import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConsultation, listMessages } from "@/lib/consultations/store";
import { isSequentialId } from "@/lib/profiles/param";
import { toChatView } from "../_lib/to-chat-view";
import { ChatRoom } from "../_components/ChatRoom";

export const metadata: Metadata = {
  title: "고민상담 · 프로젝트 사주",
};

export default async function ConsultRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/consult/${id}`);

  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다. 형식뿐 아니라
  // bigint 상한도 함께 본다(isSequentialId, param.ts) — 자릿수만 세는 정규식은
  // 19자리 안에서도 상한을 넘는 값을 놓쳐 getConsultation 의 ::bigint 캐스팅이 넘친다.
  if (!isSequentialId(id)) notFound();

  // getConsultation 이 user_id 로 함께 거르므로, 없는 상담과 남의 상담을
  // 구분하지 않고 둘 다 notFound 다.
  const consultation = await getConsultation(session.userId, id);
  if (!consultation) notFound();

  const messages = await listMessages(consultation.id);

  return (
    <ChatRoom
      consultationId={consultation.id}
      initialTurns={toChatView(messages)}
      initialRemaining={consultation.turnLimit - consultation.turnsUsed}
      initialClosed={consultation.status === "closed"}
    />
  );
}
