import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { getConsultation, listMessages } from "@/lib/consultations/store";
import { isSequentialId } from "@/lib/profiles/param";
import { toChatView } from "../_lib/to-chat-view";
import { dayLabel } from "../_lib/to-list-entry";
import { ConsultFrame } from "../_components/ConsultFrame";
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

  const [messages, user] = await Promise.all([
    listMessages(consultation.id),
    getUser(session.userId),
  ]);

  return (
    <ConsultFrame displayName={resolveDisplayName(user)}>
      <ChatRoom
        consultationId={consultation.id}
        // 첫 턴이 실패한 상담은 아직 제목이 없다. 목록의 "아직 시작하지 않은 상담"
        // 을 그대로 쓰면 이미 그 안에 들어와 있는 화면에서 말이 어긋난다.
        title={consultation.title ?? "새 상담"}
        dayLabel={dayLabel(new Date(consultation.createdAt), new Date())}
        initialTurns={toChatView(messages)}
        initialRemaining={consultation.turnLimit - consultation.turnsUsed}
        initialClosed={consultation.status === "closed"}
      />
    </ConsultFrame>
  );
}
