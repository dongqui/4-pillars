import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/**
 * 상담 화면 두 장(목록 · 대화방)이 공유하는 껍데기.
 *
 * 좁은 화면은 화면 전체를 쓰고, 900px 부터는 시안대로 가운데 선 카드가 된다 —
 * 대화방이 화면 높이를 넘어 늘어나지 않아야 입력창이 늘 아래에 붙어 있는다.
 * 900px 은 결제 화면(CheckoutView)이 이미 쓰는 경계라 맞춰 뒀다.
 *
 * 바깥이 `h-dvh` 인 이유: 시안대로 머리글을 카드 **위**에 세우면, 카드가
 * `min-h-screen` 인 채로는 머리글 높이만큼 페이지가 길어져 좁은 화면에서 입력창이
 * 화면 밖으로 밀린다. 화면 높이를 못 박고 안쪽만 흐르게 두면 픽셀을 빼는 계산
 * (`calc(100vh - 55px)`) 없이 같은 결과가 나온다 — 머리글 높이가 바뀌어도 따라온다.
 *
 * 안쪽은 세로 flex 다. 자식이 `flex-1 min-h-0` 로 스크롤 영역을 잡을 수 있어야
 * 머리글과 입력창이 고정되고 가운데만 흐른다.
 */
export function ConsultFrame({
  displayName,
  children,
}: {
  displayName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-white min-[900px]:bg-slate-50">
      <AppHeader displayName={displayName} />
      <div className="flex min-h-0 flex-1 justify-center min-[900px]:items-start min-[900px]:px-6 min-[900px]:pb-10 min-[900px]:pt-7">
        {/* overflow-hidden 은 카드일 때만 건다 — 둥근 모서리를 넘는 것을 자르는 게
            목적이라, 화면 전체를 쓰는 좁은 화면에서 걸면 잘릴 일만 생긴다.
            h-full + max-h 는 시안의 min(720px, 남은 높이)를 그대로 옮긴 것이다. */}
        <div className="flex h-full w-full min-w-0 flex-col min-[900px]:max-h-[720px] min-[900px]:max-w-[600px] min-[900px]:overflow-hidden min-[900px]:rounded-[22px] min-[900px]:border min-[900px]:border-slate-200 min-[900px]:bg-white min-[900px]:shadow-[0_12px_40px_-18px_rgba(15,23,42,0.16)]">
          {children}
        </div>
      </div>
    </div>
  );
}
