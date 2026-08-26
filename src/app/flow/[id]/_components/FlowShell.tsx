import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { HomeLink } from "@/components/HomeLink";
import type { FlowRow } from "@/lib/flows/store";
import { formatPeriod } from "@/app/flow/_lib/to-confirm";

/**
 * 헤더 + 위치 요약 + 본문 조립. MatchShell 과 같은 이유로 헤더는 즉시 그려져야
 * 한다 — 본문(children)이 <Suspense> 안에서 늦게 도착해도 나가는 길은 남는다.
 *
 * 위치 요약(기간 줄 · "N번째 구간을 지나고 있어요" · 지난 흐름 안내)은 LLM 을
 * 기다리지 않는다 — flow.segments 는 발행 시점에 박제된 계산값이라 즉시 알 수
 * 있다. MatchHero 가 계산값만 써서 <Suspense> 밖에 있는 것과 같은 이유로 여기서도
 * children(대표 문장 이하)보다 먼저, 기다림 없이 그린다.
 */
export function FlowShell({
  flow,
  index,
  now,
  children,
}: {
  flow: FlowRow;
  index: number;
  /** 페이지가 한 번만 잰 현재 시각. 컴포넌트 안에서 Date.now() 를 다시 재지
   *  않는다 — 렌더 안에서 순수하지 않은 값을 부르면 안 된다(react-hooks/purity). */
  now: Date;
  children: ReactNode;
}) {
  // currentSegmentIndex 가 기간 밖에서도 항상 칸 하나를 골라 주므로(못 찾으면
  // 마지막 칸), index 만으로는 "지금 정말 그 구간 안에 있는가" 를 알 수 없다 —
  // 시각을 직접 기간과 비교해야 한다.
  //
  // isPast 에는 isLastSegment 를 겹쳐 걸지 않는다: currentSegmentIndex 의 폴백
  // 규칙상 now >= periodEnd 면 항상 마지막 칸을 고르므로 그 조건은 이미
  // isPast 안에 포함돼 있다 — 따로 걸면 아무것도 안 걸러지는 채로 조건만
  // 길어진다.
  const isBeforeStart = now.getTime() < flow.periodStart.getTime();
  const isPast = now.getTime() >= flow.periodEnd.getTime();
  const isWithinPeriod = !isBeforeStart && !isPast;

  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
        <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
          <BrandLogo size="xs" />
          <HomeLink />
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        <section className="text-center">
          <div className="text-[13px] text-slate-400 font-mono">
            {formatPeriod(flow.periodStart, flow.periodEnd)}
          </div>
          <div className="text-[13px] text-slate-500 mt-1.5">
            {isWithinPeriod
              ? `지금은 이 흐름의 ${index + 1}번째 구간을 지나고 있어요`
              : isBeforeStart
                ? "이 흐름은 아직 시작 전이에요"
                : "이 흐름의 적용 기간이 끝났어요"}
          </div>
          {isPast && (
            <p className="mt-3 text-[13px] text-slate-400">
              이 흐름은 지났습니다 —{" "}
              <Link href="/flow" className="font-semibold underline underline-offset-2">
                새 흐름 보기
              </Link>
            </p>
          )}
        </section>
        {children}
      </main>
    </div>
  );
}
