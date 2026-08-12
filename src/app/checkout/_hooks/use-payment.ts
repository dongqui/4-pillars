"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { PaymentMethodId } from "../_lib/methods";
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

        // 공통 값과 판별자를 나눈다 — PaymentRequest 가 payMethod 로 갈라지는
        // 유니온이라, 공통 객체에 easyPay 를 스프레드로 얹으면 타입이 좁혀지지 않는다.
        const base = {
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.paymentId,
          orderName: order.orderName,
          totalAmount: order.totalAmount,
          // OrderResponse(src/lib/payments/order.ts)의 currency 가 이미 PortOne SDK 가
          // 받는 리터럴 집합의 부분집합이라 캐스팅이 필요 없다.
          currency: order.currency,
          redirectUrl: order.redirectUrl,
        };

        // 간편결제는 UI 를 직접 호출한다 — 채널이 KG이니시스 하나뿐이라
        // 어느 간편결제인지는 easyPayProvider 만이 결정한다.
        const res =
          order.payMethod === "EASY_PAY"
            ? await PortOne.requestPayment({
                ...base,
                payMethod: "EASY_PAY",
                easyPay: { easyPayProvider: order.easyPayProvider },
              })
            : await PortOne.requestPayment({ ...base, payMethod: "CARD" });

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
