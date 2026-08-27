import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/**
 * 헤더까지의 껍데기 — ReportShell 과 같은 이유로 존재한다: 본문(children)이
 * <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 *
 * 헤더는 궁합 입력(/match)·상담·홈과 같은 AppHeader 다. 예전에는 로고와 "← 홈"
 * 버튼을 여기서 직접 조립했는데, 같은 줄을 화면마다 손으로 베끼다 보니 화면마다
 * 조금씩 달라져 있었다.
 */
export function MatchShell({
  displayName,
  children,
}: {
  displayName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={displayName} />
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
