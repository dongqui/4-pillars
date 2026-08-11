import { z } from "zod";
import type { ConfirmFailure, ConfirmResult } from "@/lib/payments/confirm";
import type { PendingOrder } from "@/lib/payments/store";

const completeSchema = z.object({ paymentId: z.string().min(1) });

export interface CompleteDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  confirm(paymentId: string): Promise<ConfirmResult>;
}

export interface CompleteResult {
  status: number;
  body: { profileId: string } | { error: string; kind?: string };
}

// ConfirmFailure 로 키를 두는 이유: confirm.ts 에 kind 가 하나 추가됐는데 여기를
// 안 고치면, Record<string, number> 였을 때는 ?? 402 로 조용히 넘어갔다.
// 여기서도 컴파일이 깨지게 해 confirm.ts 의 never 전수 검사와 같은 효과를 낸다.
const FAILURE_STATUS: Record<ConfirmFailure, number> = {
  not_found: 404,
  not_paid: 402,
  amount_mismatch: 402,
  currency_mismatch: 402,
};

export async function handleComplete(raw: unknown, d: CompleteDeps): Promise<CompleteResult> {
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const { paymentId } = parsed.data;

  // 소유 확인은 여기서 한다 — confirmPayment 는 웹훅과 공유하는 함수라 세션을 모른다.
  // 없는 주문과 남의 주문을 구분하지 않는다: 구분하면 paymentId 로 존재 여부를 훑을 수 있다.
  const order = await d.findOrder(paymentId);
  if (order === null || order.userId !== d.userId) {
    return { status: 404, body: { error: "주문을 찾을 수 없습니다" } };
  }

  const result = await d.confirm(paymentId);
  if (result.ok) return { status: 200, body: { profileId: result.profileId } };

  return {
    status: FAILURE_STATUS[result.kind],
    body: { error: "결제를 확인하지 못했습니다", kind: result.kind },
  };
}
