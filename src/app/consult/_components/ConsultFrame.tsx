import type { ReactNode } from "react";

/**
 * 상담 화면 두 장(목록 · 대화방)이 공유하는 껍데기.
 *
 * 좁은 화면은 화면 전체를 쓰고, 900px 부터는 시안대로 가운데 선 카드가 된다 —
 * 대화방이 화면 높이를 넘어 늘어나지 않아야 입력창이 늘 아래에 붙어 있는다.
 * 900px 은 결제 화면(CheckoutView)이 이미 쓰는 경계라 맞춰 뒀다.
 *
 * 안쪽은 세로 flex 다. 자식이 `flex-1 min-h-0` 로 스크롤 영역을 잡을 수 있어야
 * 머리글과 입력창이 고정되고 가운데만 흐른다.
 */
export function ConsultFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-white min-[900px]:items-center min-[900px]:bg-slate-50 min-[900px]:px-6 min-[900px]:py-8">
      {/* overflow-hidden 은 카드일 때만 건다 — 둥근 모서리를 넘는 것을 자르는 게
          목적이라, 화면 전체를 쓰는 좁은 화면에서 걸면 잘릴 일만 생긴다. */}
      <div className="flex min-h-screen w-full flex-col min-[900px]:h-[min(760px,calc(100vh-64px))] min-[900px]:min-h-0 min-[900px]:max-w-[600px] min-[900px]:overflow-hidden min-[900px]:rounded-[22px] min-[900px]:border min-[900px]:border-slate-200 min-[900px]:bg-white min-[900px]:shadow-[0_12px_40px_-18px_rgba(15,23,42,0.16)]">
        {children}
      </div>
    </div>
  );
}
