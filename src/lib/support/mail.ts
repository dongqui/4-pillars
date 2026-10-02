import type { RefundReason, SupportKind } from "./types";

export interface SupportMail {
  subject: string;
  text: string;
  /** 사용자 이메일. 없으면 null — 옛 가입자는 이메일이 비어 있을 수 있다. */
  replyTo: string | null;
}

export interface SupportMailInput {
  ticketId: string;
  createdAt: string;
  kind: SupportKind;
  userId: string;
  userName: string;
  email: string | null;
  targetLabel: string | null;
  paymentId: string | null;
  refundReason: RefundReason | null;
  refundAmount?: number | null;
  refundFailed?: boolean;
  body: string;
}

const KIND_LABEL: Record<SupportKind, string> = {
  error: "오류 문의",
  feedback: "피드백",
  refund: "환불 요청",
};

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * 운영 메일 한 통. 텍스트만 보낸다 — 받는 사람은 우리뿐이고, HTML 은 사용자가 쓴 본문을
 * 이스케이프해야 하는 부담만 늘린다.
 */
export function composeSupportMail(i: SupportMailInput): SupportMail {
  // 자동 환불이 끝난 메일(환불액이 있고 실패가 아님)은 옛 "[환불 요청] 취소해 주세요" 메일과 제목이
  // 달라야 한다 — 같으면 운영자가 이미 끝난 건을 또 취소하려 든다. [환불 요청] 은 환불액이 없는 옛 경로에만 남는다.
  const refundDone = i.kind === "refund" && !i.refundFailed && i.refundAmount != null;
  const head =
    i.kind === "refund" && i.refundFailed ? "[환불 실패]" : refundDone ? "[환불 완료]" : `[${KIND_LABEL[i.kind]}]`;
  const subject = i.targetLabel ? `${head} ${i.targetLabel} — ${i.userName}` : `${head} ${i.userName}`;

  const lines = [
    `문의 #${i.ticketId} · ${KST.format(new Date(i.createdAt))} (KST)`,
    "",
    `사용자 ${i.userId} · ${i.userName}`,
    `이메일: ${i.email ?? "(없음)"}`,
  ];
  if (i.targetLabel) lines.push(`대상: ${i.targetLabel}`);
  if (i.paymentId) lines.push(`결제 ID: ${i.paymentId}`);
  if (i.refundReason) lines.push(`환불 사유: ${i.refundReason}`);
  if (i.refundAmount != null) lines.push(`환불액: ${i.refundAmount.toLocaleString("ko-KR")}원`);
  if (refundDone) lines.push("포트원 취소 완료 — 조치 불필요");
  if (i.refundFailed) lines.push("⚠️ 포트원 취소 실패 — DB 는 refunded 다. 콘솔에서 수동 취소할 것.");
  lines.push("", "─ 내용 ─", i.body.trim() === "" ? "(내용 없음)" : i.body);

  return { subject, text: lines.join("\n"), replyTo: i.email };
}
