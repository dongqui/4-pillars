import { z } from "zod";
import { isRefundable, refundAmount } from "@/lib/payments/refund";
import type { RefundCandidate } from "@/lib/payments/refund-store";
import { composeSupportMail } from "@/lib/support/mail";
import type { Mailer } from "@/lib/support/mailer";
import type { NewSupportTicket } from "@/lib/support/store";
import { BODY_MAX, REFUND_REASONS, optionLabel } from "@/lib/support/types";

const bodySchema = z.object({
  purchaseId: z.string().regex(/^\d+$/),
  reason: z.enum(REFUND_REASONS),
  body: z.string().trim().max(BODY_MAX).default(""),
});

export interface RefundDeps {
  userId: string | null;
  now: Date;
  /** 포트원 시크릿이 있는지. 없으면 DB 를 건드리기 전에 막는다 — 차감한 뒤엔 취소할 수 없다. */
  configured(): boolean;
  checkLimit(userId: string): Promise<boolean>;
  getUser(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
  findCandidate(purchaseId: string, userId: string): Promise<RefundCandidate | null>;
  execute(a: { purchaseId: string; userId: string; amount: number; remaining: number; now: Date }): Promise<{ paymentId: string; remaining: number } | null>;
  cancel(paymentId: string, o: { reason: string; amount?: number }): Promise<void>;
  markFailed(purchaseId: string): Promise<void>;
  insertTicket(t: NewSupportTicket): Promise<{ id: string; createdAt: string } | null>;
  mailer: Mailer | null;
  /** 응답 뒤로 미룰 일(next/server 의 after). 메일을 여기로 미루는 이유는 support 핸들러와 같다. */
  defer(task: () => Promise<void>): void;
}

type Result = { status: number; body: { amount: number; pending: boolean } | { error: string } };

const BAD = { status: 400, body: { error: "요청을 확인해 주세요" } } as const;
const NOT_REFUNDABLE = { status: 409, body: { error: "환불할 수 없는 결제예요" } } as const;

/** 목록(toPurchaseOption)과 같은 "이용권 N장 · M원" — 티켓·메일의 대상 라벨. */
function candidateLabel(c: RefundCandidate): string {
  return optionLabel({
    title: c.tickets === null ? "이용권" : `이용권 ${c.tickets}장`,
    sub: `${c.amount.toLocaleString("ko-KR")}원`,
  });
}

/**
 * 환불을 그 자리에서 끝낸다: 규칙 검사 → DB 차감(한 문장) → 포트원 취소 → 기록·메일.
 *
 * 포트원 실패를 DB 롤백으로 돌리지 않는다 — "돈은 안 나갔는데 이용권이 사라진" 상태는 운영자가
 * 콘솔에서 취소를 마저 하면 맞춰지지만, 반대("돈은 나갔는데 이용권이 남은")는 유저가 그 이용권을
 * 더 써 버릴 수 있어 되돌리기 어렵다. 유저에게는 pending 으로 "접수" 를 알린다.
 *
 * execute 가 던지는 경우(잔액 CHECK 롤백)는 잡지 않는다 — DB 가 바뀌지 않았으니 포트원도 티켓도
 * 없어야 하고, 라우트가 500 으로 옮긴다. 시크릿 미설정은 execute 전에 503 으로 막는다(configured).
 *
 * execute 가 행을 돌려준 뒤에는 2xx 만 돌려준다 — DB 는 이미 refunded 라 500 을 받은 사용자가
 * 다시 눌러도 409 일 뿐이고, 운영자에게 갈 메일이 사라진다. markFailed·insertTicket 이 던져도
 * 로그만 남기고 메일까지 간다.
 */
export async function handleRefund(raw: unknown, d: RefundDeps): Promise<Result> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  const userId = d.userId;

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return BAD;
  const input = parsed.data;

  if (!(await d.checkLimit(userId))) return { status: 429, body: { error: "잠시 후 다시 시도해 주세요" } };

  const user = await d.getUser(userId);
  if (!user) return { status: 401, body: { error: "로그인이 필요합니다" } };

  if (!d.configured()) return { status: 503, body: { error: "지금은 환불을 처리할 수 없어요" } };

  // 목록이 걸렀어도 실행 직전에 다시 본다 — 그 사이 7일이 지났거나 이용권을 썼을 수 있다.
  // 클라이언트가 보낸 금액은 받지 않는다(스키마에 없다). 여기서 읽은 행으로 계산한다.
  const c = await d.findCandidate(input.purchaseId, userId);
  if (!c || c.remaining === null || !isRefundable(c, d.now)) return NOT_REFUNDABLE;
  const amount = refundAmount(c);

  const done = await d.execute({ purchaseId: c.purchaseId, userId, amount, remaining: c.remaining, now: d.now });
  if (!done) return NOT_REFUNDABLE;

  // 전액이면 amount 를 생략한다 — 포트원은 amount 없는 요청을 전액 취소로 본다.
  const cancelArgs: { reason: string; amount?: number } =
    amount === c.amount ? { reason: input.reason } : { reason: input.reason, amount };

  let failure: string | null = null;
  try {
    await d.cancel(done.paymentId, cancelArgs);
  } catch (e) {
    try {
      await d.markFailed(c.purchaseId);
    } catch (markError) {
      console.error("[refund] 실패 시각 기록 실패", c.purchaseId, done.paymentId, amount, markError);
    }
    const type = e instanceof Error && "type" in e && typeof e.type === "string" ? e.type : "unknown";
    const message = e instanceof Error ? e.message : String(e);
    failure = `${type}: ${message}`;
    console.error("[refund] 포트원 취소 실패", c.purchaseId, done.paymentId, failure);
  }

  const ticket: NewSupportTicket = {
    userId,
    kind: "refund",
    targetKind: null,
    targetRef: null,
    targetLabel: candidateLabel(c),
    purchaseId: c.purchaseId,
    refundReason: input.reason,
    body: input.body,
    replyEmail: user.email,
    status: failure ? "open" : "resolved",
    adminNote: failure
      ? `포트원 취소 실패(${failure}) — 콘솔에서 수동 취소`
      : `자동 환불 ${amount.toLocaleString("ko-KR")}원`,
  };
  let saved: { id: string; createdAt: string } | null = null;
  try {
    saved = await d.insertTicket(ticket);
    if (!saved) console.warn("[refund] 티켓이 저장되지 않았다(열린 환불 요청과 충돌)", c.purchaseId);
  } catch (e) {
    console.error("[refund] 티켓 저장 실패", c.purchaseId, done.paymentId, amount, failure, e);
  }

  const mailer = d.mailer;
  if (!mailer) {
    console.warn("[refund] 메일 설정이 비어 있어 알림을 건너뜁니다", c.purchaseId);
  } else {
    const mail = composeSupportMail({
      ticketId: saved?.id ?? "-",
      createdAt: saved?.createdAt ?? d.now.toISOString(),
      kind: "refund",
      userId,
      userName: user.displayName ?? "이름 없음",
      email: user.email,
      targetLabel: ticket.targetLabel,
      paymentId: done.paymentId,
      refundReason: input.reason,
      refundAmount: amount,
      refundFailed: failure !== null,
      body: input.body,
    });
    d.defer(async () => {
      try {
        await mailer.send(mail);
      } catch (e) {
        console.error("[refund] 알림 메일 실패", c.purchaseId, e);
      }
    });
  }

  return { status: 200, body: { amount, pending: failure !== null } };
}
