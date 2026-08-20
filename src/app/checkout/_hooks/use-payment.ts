"use client";
import { useCallback, useState } from "react";
import { ANONYMOUS, loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { PaymentMethodId } from "../_lib/methods";
import type { TicketPackageId } from "../_lib/pricing";
import type { OrderResponse } from "@/lib/payments/order";

export type PaymentStatus = "idle" | "pending";

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message ?? "결제를 진행하지 못했습니다");
  }
  return data;
}

/**
 * 결제 시작. 주문 생성 → 결제창 → (토스가 착지 페이지로 보냄).
 *
 * 금액·상품명을 여기서 만들지 않는다 — 전부 주문 생성 응답에서 온다.
 * 브라우저가 정할 수 있는 값은 "어느 패키지를 어느 수단으로" 뿐이다.
 *
 * 확정 호출이 여기 없는 이유: 토스 결제창은 성공하면 successUrl 로 페이지를
 * 떠난다. 승인은 거기(/checkout/complete)에서 서버가 한다 — 브라우저가 승인을
 * 부르게 두면 창을 닫아 버린 사용자의 결제가 영원히 승인되지 않는다.
 */
export function usePayment(next: string) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async (packageId: TicketPackageId, method: PaymentMethodId) => {
      setStatus("pending");
      setError(null);
      try {
        const order = (await postJson("/api/payments/orders", {
          packageId,
          method,
          next,
        })) as OrderResponse;

        const toss = await loadTossPayments(order.clientKey);
        // customerKey 가 익명인 이유: 자동결제(빌링)를 쓰지 않는다. 카드를 저장하지
        // 않으므로 토스 쪽에 우리 사용자를 식별시킬 이유가 없다.
        const payment = toss.payment({ customerKey: ANONYMOUS });

        // 토스 파라미터와 이름이 1:1 로 맞는 값들. 결제수단만 아래에서 갈린다.
        const common = {
          method: "CARD",
          amount: order.amount,
          orderId: order.orderId,
          orderName: order.orderName,
          successUrl: order.successUrl,
          failUrl: order.failUrl,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
        } as const;

        // 네 수단 모두 method 는 CARD 다. 갈리는 것은 card.flowMode 뿐이라
        // 판별자를 좁혀서 쓴다 — 스프레드만으로는 easyPay 누락을 잡아 주지 않는다.
        if (order.flowMode === "DIRECT") {
          await payment.requestPayment({
            ...common,
            card: { flowMode: "DIRECT", easyPay: order.easyPay },
          });
        } else {
          await payment.requestPayment({ ...common, card: { flowMode: "DEFAULT" } });
        }

        // 성공하면 여기까지 오지 않는다 — 결제창이 successUrl 로 페이지를 떠났고,
        // 돌아올 때는 /checkout/complete 가 받는다. 사용자가 창을 닫으면
        // requestPayment 가 거부돼 아래 catch 로 간다.
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제를 진행하지 못했습니다");
        setStatus("idle");
      }
    },
    [next],
  );

  return { pay, status, error };
}
