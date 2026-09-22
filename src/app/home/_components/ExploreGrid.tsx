import Link from "next/link";
import { featurePriceLabel } from "../../_lib/catalog";

interface Props {
  /** 저장된 프로필이면 그 리포트로, 아직 계정이 없으면 드래프트 리포트(/report)로 */
  reportHref: string;
  /**
   * 상담 입구. 비로그인이어도 링크를 잠그지 않는다 — /consult 가 로그인으로
   * 넘긴다. 로그인 벽에서 흐름을 끊지 않는 피벗 정책과 같은 이유다.
   */
  consultHref: string;
}

const CARD =
  "flex flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 md:px-5 md:py-[18px]";
const HEAD = "mb-[9px] flex items-center justify-between gap-2";
const EYEBROW = "text-[11.5px] font-bold tracking-[0.08em] text-slate-400";
/** 시안의 가격 배지. 무료는 파랑(accent-50/700), 유료는 회색(slate-100/600). */
const BADGE =
  "flex-none whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold tracking-[-0.01em]";
const BADGE_FREE = `${BADGE} bg-accent-50 text-accent-700`;
const BADGE_PAID = `${BADGE} bg-slate-100 text-slate-600`;
const TITLE = "mb-[5px] text-base font-bold tracking-[-0.025em]";
const DESC =
  "mb-[18px] text-[13.5px] leading-[1.55] text-gray-500 [text-wrap:pretty]";
const CTA = "mt-auto whitespace-nowrap text-sm font-bold text-accent";

/**
 * 배지 문구는 문자열로 박지 않는다 — 랜딩과 같은 catalog 에서 이용권 단가로
 * 계산한다. 리포트만 예외로 "일부 무료" 를 덧붙인다(캐릭터·개요는 무료 구간).
 */
export function ExploreGrid({ reportHref, consultHref }: Props) {
  const report = `${featurePriceLabel("full_report")} · 일부 무료`;
  return (
    <section className="mx-auto max-w-[780px] px-5 pb-9 pt-5 md:px-8 md:pb-[52px] md:pt-[26px]">
      <div className="grid grid-cols-1 items-stretch gap-2.5 md:grid-cols-2">
        <Link href={reportHref} className={CARD}>
          <div className={HEAD}>
            <span className={EYEBROW}>나를 더 깊이</span>
            <span className={BADGE_PAID}>{report}</span>
          </div>
          <div className={TITLE}>리포트</div>
          <p className={DESC}>
            기질과 사고방식, 감정의 결까지 더 깊이 살펴보세요.
          </p>
          <span className={CTA}>리포트 보기 →</span>
        </Link>

        <Link href="/flow" className={CARD}>
          <div className={HEAD}>
            <span className={EYEBROW}>한 해의 나</span>
            <span className={BADGE_PAID}>{featurePriceLabel("yearly_flow")}</span>
          </div>
          <div className={TITLE}>한 해의 흐름</div>
          <p className={DESC}>
            궁금한 해를 골라, 그해의 큰 흐름부터 달마다 달라지는 변화까지.
          </p>
          <span className={CTA}>흐름 보기 →</span>
        </Link>

        <Link href={consultHref} className={CARD}>
          <div className={HEAD}>
            <span className={EYEBROW}>조금 더 묻고 싶을 때</span>
            <span className={BADGE_PAID}>{featurePriceLabel("consultation")}</span>
          </div>
          <div className={TITLE}>고민상담</div>
          <p className={DESC}>
            내 사주를 바탕으로, 지금 마음에 걸리는 이야기를 나눠보세요.
          </p>
          <span className={CTA}>상담 시작하기 →</span>
        </Link>

        <Link href="/map" className={CARD}>
          <div className={HEAD}>
            <span className={EYEBROW}>사람 사이의 나</span>
            <span className={BADGE_FREE}>무료</span>
          </div>
          <div className={TITLE}>관계 지도</div>
          <p className={DESC}>내 주변 사람들은 나에게 어떤 역할을 할까요?</p>
          <span className={CTA}>사람 추가하기 →</span>
        </Link>

        <Link href="/match" className={CARD}>
          <div className={HEAD}>
            <span className={EYEBROW}>두 사람의 관계</span>
            <span className={BADGE_PAID}>{featurePriceLabel("compatibility")}</span>
          </div>
          <div className={TITLE}>궁합</div>
          <p className={DESC}>한 사람과 나의 관계를 자세히 살펴봐요.</p>
          <span className={CTA}>궁합 보기 →</span>
        </Link>
      </div>
    </section>
  );
}
