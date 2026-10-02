import { z } from "zod";
import { composeSupportMail } from "@/lib/support/mail";
import type { Mailer } from "@/lib/support/mailer";
import type { NewSupportTicket } from "@/lib/support/store";
import {
  BODY_MAX,
  REFUND_REASONS,
  TARGET_KINDS,
  optionLabel,
  type PurchaseOption,
  type ServiceOption,
  type SupportOptions,
} from "@/lib/support/types";

// trim 을 먼저 하는 이유: 공백만 있는 본문은 빈 본문이다(클라이언트 canSubmit 과 같은 판단).
const bodyText = z.string().trim().max(BODY_MAX);

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("error"),
    target: z.object({
      kind: z.enum(TARGET_KINDS),
      ref: z.string().min(1).max(64).nullable(),
    }),
    body: bodyText.min(1),
  }),
  z.object({ kind: z.literal("feedback"), body: bodyText.min(1) }),
  z.object({
    kind: z.literal("refund"),
    purchaseId: z.string().regex(/^\d+$/),
    reason: z.enum(REFUND_REASONS),
    body: bodyText.default(""),
  }),
]);

export interface CreateSupportDeps {
  userId: string | null;
  checkLimit(userId: string): Promise<boolean>;
  getUser(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
  listServiceOptions(userId: string): Promise<ServiceOption[]>;
  listPurchaseOptions(userId: string): Promise<PurchaseOption[]>;
  insertTicket(t: NewSupportTicket): Promise<{ id: string; createdAt: string } | null>;
  /** null 이면 메일 설정이 비어 있다 — 저장만 한다. */
  mailer: Mailer | null;
}

type Result = { status: number; body: { id: string } | { error: string } };

const BAD = { status: 400, body: { error: "요청을 확인해 주세요" } } as const;
const DUPLICATE = { status: 409, body: { error: "이미 접수된 환불 요청이 있어요" } } as const;

export async function handleCreateSupportTicket(raw: unknown, d: CreateSupportDeps): Promise<Result> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  const userId = d.userId;

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return BAD;
  const input = parsed.data;

  if (!(await d.checkLimit(userId))) {
    return { status: 429, body: { error: "잠시 후 다시 시도해 주세요" } };
  }

  const user = await d.getUser(userId);
  if (!user) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const ticket: NewSupportTicket = {
    userId,
    kind: input.kind,
    targetKind: null,
    targetRef: null,
    targetLabel: null,
    purchaseId: null,
    refundReason: null,
    body: input.body,
    replyEmail: user.email,
  };
  let paymentId: string | null = null;

  if (input.kind === "error") {
    const { kind, ref } = input.target;
    ticket.targetKind = kind;
    if (kind === "other") {
      ticket.targetLabel = "기타";
    } else {
      // 클라이언트가 보낸 대상이 정말 이 사용자의 것인지, 목록을 다시 읽어 확인한다.
      // 없는 것과 남의 것을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
      const found = (await d.listServiceOptions(userId)).find(
        (o) => o.target.kind === kind && o.target.ref === ref,
      );
      if (!found) return { status: 404, body: { error: "항목을 찾을 수 없습니다" } };
      ticket.targetRef = ref;
      ticket.targetLabel = optionLabel(found);
    }
  } else if (input.kind === "refund") {
    const found = (await d.listPurchaseOptions(userId)).find((p) => p.purchaseId === input.purchaseId);
    if (!found) return { status: 404, body: { error: "결제 내역을 찾을 수 없습니다" } };
    if (found.requested) return DUPLICATE;
    ticket.purchaseId = found.purchaseId;
    ticket.refundReason = input.reason;
    ticket.targetLabel = optionLabel(found);
    paymentId = found.paymentId;
  }

  const saved = await d.insertTicket(ticket);
  // 앱 검사(requested)를 동시 요청 두 개가 함께 통과한 경우 — 0053 의 인덱스가 하나를 막았다.
  if (!saved) return DUPLICATE;

  if (!d.mailer) {
    console.warn("[support] 메일 설정이 비어 있어 알림을 건너뜁니다", saved.id);
  } else {
    try {
      await d.mailer.send(
        composeSupportMail({
          ticketId: saved.id,
          createdAt: saved.createdAt,
          kind: ticket.kind,
          userId,
          userName: user.displayName ?? "이름 없음",
          email: user.email,
          targetLabel: ticket.targetLabel,
          paymentId,
          refundReason: ticket.refundReason,
          body: ticket.body,
        }),
      );
    } catch (e) {
      // 문의는 이미 저장됐다. 메일 실패로 사용자에게 오류를 보이면 다시 보내 중복만 생긴다.
      console.error("[support] 알림 메일 실패", saved.id, e);
    }
  }

  return { status: 201, body: { id: saved.id } };
}

export interface SupportOptionsDeps {
  userId: string | null;
  listServiceOptions(userId: string): Promise<ServiceOption[]>;
  listPurchaseOptions(userId: string): Promise<PurchaseOption[]>;
  getBalance(userId: string): Promise<number>;
}

export async function handleSupportOptions(
  kind: string | null,
  d: SupportOptionsDeps,
): Promise<{ status: number; body: SupportOptions | { error: string } }> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  if (kind === "error") {
    return { status: 200, body: { kind: "error", items: await d.listServiceOptions(d.userId) } };
  }
  if (kind === "refund") {
    const [items, balance] = await Promise.all([d.listPurchaseOptions(d.userId), d.getBalance(d.userId)]);
    return { status: 200, body: { kind: "refund", items, balance } };
  }
  return BAD;
}
