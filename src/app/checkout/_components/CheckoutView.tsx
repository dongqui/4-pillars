"use client";
import { useState } from "react";
import Link from "next/link";
import { PAYMENT_METHODS, type PaymentMethodId } from "../_lib/methods";
import type { OrderTarget } from "../_lib/to-order";
import { usePayment } from "../_hooks/use-payment";
import { PaymentMethodList } from "./PaymentMethodList";
import { OrderSummary } from "./OrderSummary";
import { StickyPayBar } from "./StickyPayBar";

/**
 * 결제 화면의 상태를 가진 유일한 곳. 결제수단은 안내문을, 약관 동의는 결제 버튼
 * 두 개(인라인·고정 바)를 동시에 움직이므로 한 군데서 들고 내려보낸다.
 *
 * 디자인은 window.innerWidth 로 모바일을 갈랐지만 여기서는 CSS 미디어쿼리로 한다 —
 * 폭을 JS 로 재면 서버가 그린 첫 화면이 데스크톱으로 나왔다가 마운트 후 튄다.
 */
export function CheckoutView({
  profileId,
  target,
  available,
}: {
  profileId: string;
  target: OrderTarget;
  available: PaymentMethodId[];
}) {
  // 화면 순서는 PAYMENT_METHODS 가, 사용 가능 여부는 서버가 정한다.
  const methods = PAYMENT_METHODS.filter((m) => available.includes(m.id));
  const [method, setMethod] = useState<PaymentMethodId>(methods[0]?.id ?? "card");
  const [agreed, setAgreed] = useState(false);
  const { pay, status, error } = usePayment(profileId);
  const pending = status === "pending";
  const ready = methods.length > 0;

  return (
    <>
      <main className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-[132px] sm:px-6 sm:pt-[clamp(32px,5vw,56px)] sm:pb-[120px]">
        <div className="mb-[clamp(22px,4vw,32px)]">
          <Link
            href={`/report?profile=${profileId}`}
            className="mb-3 inline-block text-[13.5px] font-semibold text-slate-400 hover:text-slate-600"
          >
            ← 리포트로 돌아가기
          </Link>
          <h1 className="m-0 text-[clamp(24px,5vw,34px)] font-bold tracking-[-0.035em]">
            결제하기
          </h1>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_348px]">
          <div className="flex flex-col gap-5">
            {ready ? (
              <PaymentMethodList methods={methods} selected={method} onSelect={setMethod} />
            ) : (
              // 키가 없으면 정직하게 잠근다 — 빈 목록을 보여주고 버튼만 살려 두면
              // 사용자는 눌러 보고 나서야 안 된다는 걸 안다.
              <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-8 text-center shadow-[0_1px_3px_rgba(17,24,39,.04)] sm:p-10">
                <p className="m-0 text-[15px] font-semibold tracking-[-0.01em]">
                  결제를 준비 중입니다
                </p>
                <p className="mt-2 mb-0 text-[13.5px] leading-[1.6] text-slate-400">
                  곧 결제 수단을 열어 드릴게요. 조금만 기다려 주세요.
                </p>
              </section>
            )}
          </div>

          <aside className="min-[900px]:sticky min-[900px]:top-6">
            <OrderSummary
              target={target}
              agreed={agreed}
              canPay={agreed && ready}
              pending={pending}
              onToggleAgree={() => setAgreed((v) => !v)}
              onPay={() => pay(method)}
            />
            <p className="mt-3.5 mr-1 ml-1 text-[12.5px] leading-[1.6] text-slate-300 [text-wrap:pretty]">
              디지털 콘텐츠 특성상 리포트 열람 후에는 환불이 불가합니다. 열람 전 7일 내 전액 환불
              가능합니다.
            </p>
          </aside>
        </div>
      </main>

      {error && (
        <p
          role="alert"
          className="mx-auto mb-4 w-full max-w-[1040px] px-4 text-[13.5px] font-semibold text-red-600 sm:px-6"
        >
          {error}
        </p>
      )}
      <StickyPayBar agreed={agreed && ready} pending={pending} onPay={() => pay(method)} />
    </>
  );
}
