"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { PaymentMethodId } from "../_lib/methods";

export type PaymentStatus = "idle" | "pending";

interface OrderResponse {
  paymentId: string;
  storeId: string;
  channelKey: string;
  payMethod: string;
  orderName: string;
  totalAmount: number;
  currency: string;
  redirectUrl: string;
}

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
 * 결제 시작. 주문 생성 → 결제창 → 완료 확정 → 리포트.
 *
 * 금액·상품명을 여기서 만들지 않는다 — 전부 주문 생성 응답에서 온다.
 * 브라우저가 정할 수 있는 값은 "어느 프로필을 어느 수단으로" 뿐이다.
 */
export function usePayment(profileId: string) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async (method: PaymentMethodId) => {
      setStatus("pending");
      setError(null);
      try {
        const order = (await postJson("/api/payments/orders", {
          profileId,
          method,
        })) as OrderResponse;

        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.paymentId,
          orderName: order.orderName,
          totalAmount: order.totalAmount,
          // 주문 생성 응답은 string 이지만 실제 값은 서버(src/lib/payments/config.ts)가
          // PortOne 이 받는 코드 집합 안에서만 만든다 — SDK 의 유니온 타입으로 캐스팅한다.
          currency: order.currency as PortOne.PaymentCurrency,
          payMethod: order.payMethod as PortOne.PaymentPayMethod,
          redirectUrl: order.redirectUrl,
        });

        // 모바일은 여기까지 오지 않는다 — 결제창이 페이지를 떠났고,
        // 돌아올 때는 /checkout/complete 가 받는다.
        // code 가 있으면 실패다. 사용자가 결제창을 닫아도 이 갈래로 온다.
        if (res?.code != null) throw new Error(res.message ?? "결제가 취소되었습니다");

        await postJson("/api/payments/complete", { paymentId: order.paymentId });
        // replace 인 이유: 뒤로 가기로 결제 화면에 돌아오면 이미 결제된 프로필이라
        // /checkout 가드가 다시 리포트로 튕긴다 — 히스토리에 남길 이유가 없다.
        router.replace(`/report?profile=${profileId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제를 진행하지 못했습니다");
        setStatus("idle");
      }
    },
    [profileId, router],
  );

  return { pay, status, error };
}
