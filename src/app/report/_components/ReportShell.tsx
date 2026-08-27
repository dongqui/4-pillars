import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/**
 * 헤더까지의 껍데기. 본문을 children 으로 받는 이유는 스트리밍이다 —
 * 본문이 <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 * 에러 화면·대기 화면도 이 안에 들어간다(헤더가 있어야 /home 으로 나갈 수 있다).
 *
 * 헤더는 홈·상담·궁합·흐름과 같은 AppHeader 다. 예전에는 로고와 "← 홈" 을 여기서
 * 직접 조립했는데, 같은 줄을 화면마다 손으로 베끼다 보니 조금씩 달라져 있었다.
 * "공유하기" 만 이 화면의 것이라 여기 남는다.
 */
export function ReportShell({
  displayName,
  children,
}: {
  /** 비로그인이면 null — 리포트는 계정 없이도 보이는 화면이다(익명 드래프트). */
  displayName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={displayName}>
        {/* 높이를 34px 로 못 박는다 — 옆의 메뉴 버튼과 같은 값이라야 리포트 헤더만
            다른 화면보다 두꺼워지지 않는다(py-2 로 두면 66.5px 이 된다). */}
        <button
          type="button"
          className="inline-flex h-[34px] cursor-pointer items-center rounded-[10px] border border-slate-200 bg-white px-[14px] text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          공유하기
        </button>
      </AppHeader>
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
