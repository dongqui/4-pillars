import type { ReactNode } from "react";
import { ReportHeader } from "./ReportHeader";

/**
 * 헤더까지의 껍데기. 본문을 children 으로 받는 이유는 스트리밍이다 —
 * 본문이 <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 * 에러 화면·대기 화면도 이 안에 들어간다(헤더가 있어야 /home 으로 나갈 수 있다).
 */
export function ReportShell({
  showHomeLink,
  children,
}: {
  showHomeLink: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <ReportHeader showHomeLink={showHomeLink} />
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
