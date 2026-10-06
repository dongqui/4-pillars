import { z } from "zod";
import { composeSupportMail } from "@/lib/support/mail";
import type { Mailer } from "@/lib/support/mailer";
import type { NewSupportTicket } from "@/lib/support/store";
import {
  BODY_MAX,
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
]);

export interface CreateSupportDeps {
  userId: string | null;
  checkLimit(userId: string): Promise<boolean>;
  getUser(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
  listServiceOptions(userId: string): Promise<ServiceOption[]>;
  insertTicket(t: NewSupportTicket): Promise<{ id: string; createdAt: string } | null>;
  /** null 이면 메일 설정이 비어 있다 — 저장만 한다. */
  mailer: Mailer | null;
  /**
   * 응답을 보낸 뒤에 돌릴 일(라우트에서는 next/server 의 after). 메일을 여기로 미루는 이유:
   * Resend 가 느리거나 멈추면 사용자는 닫을 수 없는 "보내는 중" 모달에 갇히고, 끝내 타임아웃을
   * 받아 이미 저장된 문의를 다시 보낸다 — 중복 문의, 환불은 엉뚱한 409 가 된다.
   */
  defer(task: () => Promise<void>): void;
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
  const paymentId: string | null = null;

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
  }

  const saved = await d.insertTicket(ticket);
  // INSERT 가 아무것도 돌려주지 않은 경우. 환불 티켓은 /api/refunds 가 넣는다.
  if (!saved) return DUPLICATE;

  const mailer = d.mailer;
  if (!mailer) {
    console.warn("[support] 메일 설정이 비어 있어 알림을 건너뜁니다", saved.id);
  } else {
    const mail = composeSupportMail({
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
    });
    d.defer(async () => {
      try {
        await mailer.send(mail);
      } catch (e) {
        // 문의는 이미 저장됐고 응답도 나갔다. 놓친 메일은 어드민 받은편지함에서 보인다.
        console.error("[support] 알림 메일 실패", saved.id, e);
      }
    });
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
