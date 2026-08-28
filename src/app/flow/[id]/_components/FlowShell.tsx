import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import type { FlowRow } from "@/lib/flows/store";
import { formatPeriod } from "@/app/flow/_lib/to-confirm";

/**
 * 헤더 + 위치 요약 + 본문 조립. MatchShell 과 같은 이유로 헤더는 즉시 그려져야
 * 한다 — 본문(children)이 <Suspense> 안에서 늦게 도착해도 나가는 길은 남는다.
 *
 * 위치 요약은 LLM 을 기다리지 않는다 — flow.months 와 기간은 발행 시점에 박제된
 * 계산값이라 즉시 알 수 있다.
 *
 * "지났습니다" 같은 안내를 더 이상 하지 않는다. 사용자가 직접 고른 해이므로 지난
 * 해인 것은 실수가 아니라 의도다(§25: 과거 복기가 이 서비스의 절반이다).
 */
export function FlowShell({
  flow,
  profileName,
  displayName,
  children,
}: {
  flow: FlowRow;
  profileName: string;
  /** 헤더 메뉴에 서는 이름. 로그인 필수 화면이라 실제로는 null 이 오지 않는다. */
  displayName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={displayName} />
      <main className="mx-auto max-w-[720px] px-[clamp(20px,5vw,24px)] pb-24 pt-[clamp(36px,7vw,64px)]">
        <section className="text-center">
          <div className="text-[13px] text-slate-500">
            {profileName} · {flow.flowYear}년
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-slate-400">
            {formatPeriod(flow.periodStart, flow.periodEnd)}
          </div>
        </section>
        {children}
        <p className="mt-16 text-center text-[13px] text-slate-400">
          <Link href="/flow" className="font-semibold underline underline-offset-2">
            다른 해도 살펴보기
          </Link>
        </p>
      </main>
    </div>
  );
}
