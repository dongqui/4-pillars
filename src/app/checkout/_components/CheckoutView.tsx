"use client";
import { useState } from "react";
import Link from "next/link";
import { DEFAULT_PAYMENT_METHOD, type PaymentMethodId } from "../_lib/methods";
import type { OrderTarget } from "../_lib/to-order";
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
}: {
  profileId: string;
  target: OrderTarget;
}) {
  const [method, setMethod] = useState<PaymentMethodId>(DEFAULT_PAYMENT_METHOD);
  // 디자인 목업은 체크된 상태로 시작하지만 여기서는 비운다 — 결제·제3자 제공 동의를
  // 미리 체크해 두면 사용자가 실제로 동의했다는 근거가 없다(전자상거래법).
  const [agreed, setAgreed] = useState(false);

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
            <PaymentMethodList selected={method} onSelect={setMethod} />
          </div>

          <aside className="min-[900px]:sticky min-[900px]:top-6">
            <OrderSummary
              target={target}
              agreed={agreed}
              onToggleAgree={() => setAgreed((v) => !v)}
            />
            <p className="mt-3.5 mr-1 ml-1 text-[12.5px] leading-[1.6] text-slate-300 [text-wrap:pretty]">
              디지털 콘텐츠 특성상 리포트 열람 후에는 환불이 불가합니다. 열람 전 7일 내 전액 환불
              가능합니다.
            </p>
          </aside>
        </div>
      </main>

      <StickyPayBar agreed={agreed} />
    </>
  );
}
