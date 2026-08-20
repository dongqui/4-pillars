import Link from "next/link";

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
  "relative flex flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 md:px-5 md:py-[18px]";
const EYEBROW =
  "mb-[9px] text-[11.5px] font-bold tracking-[0.08em] text-slate-400";
const TITLE = "mb-[5px] text-base font-bold tracking-[-0.025em]";
const DESC =
  "mb-[18px] text-[13.5px] leading-[1.55] text-gray-500 [text-wrap:pretty]";
const CTA = "mt-auto whitespace-nowrap text-sm font-bold text-accent";
const ART =
  "pointer-events-none absolute bottom-[15px] right-4 flex items-center gap-[7px] opacity-55 md:bottom-[17px] md:right-5";

/** 카드 구석의 점 그림 — 기능을 설명하는 그림이라 스크린리더에서는 뺀다 */
function Dot({ size, style }: { size: number; style: string }) {
  return (
    <span
      className={`flex-none rounded-full ${style}`}
      style={{ width: size, height: size }}
    />
  );
}

export function ExploreGrid({ reportHref, consultHref }: Props) {
  return (
    <section className="mx-auto max-w-[780px] px-5 pb-9 pt-5 md:px-8 md:pb-[52px] md:pt-[26px]">
      <div className="grid grid-cols-1 items-stretch gap-2.5 md:grid-cols-2">
        <Link href={reportHref} className={CARD}>
          <div className={EYEBROW}>나를 더 깊이</div>
          <div className={TITLE}>리포트</div>
          <p className={DESC}>
            기질과 사고방식, 감정의 결까지 더 깊이 살펴보세요.
          </p>
          <span className={CTA}>리포트 보기 →</span>
        </Link>

        <Link href={consultHref} className={CARD}>
          <div className={EYEBROW}>나에게 묻고 싶을 때</div>
          <div className={TITLE}>고민상담</div>
          <p className={DESC}>
            털어놓고 싶은 이야기, 사주를 아는 상대와 나눠보세요.
          </p>
          <span className={CTA}>상담 시작하기 →</span>
          <span aria-hidden className={ART}>
            <Dot size={7} style="bg-slate-300" />
            <Dot size={9} style="bg-slate-400" />
            <Dot size={11} style="bg-slate-900" />
          </span>
        </Link>

        <Link href="/map" className={CARD}>
          <div className={EYEBROW}>사람 사이의 나</div>
          <div className={TITLE}>관계 지도</div>
          <p className={DESC}>내 주변 사람들은 나에게 어떤 역할을 할까요?</p>
          <span className={CTA}>사람 추가하기 →</span>
          <span aria-hidden className={ART}>
            <Dot
              size={10}
              style="border-[1.5px] border-dashed border-slate-300"
            />
            <Dot size={13} style="bg-slate-900" />
            <Dot
              size={10}
              style="border-[1.5px] border-dashed border-slate-300"
            />
            <Dot
              size={8}
              style="border-[1.5px] border-dashed border-slate-200"
            />
          </span>
        </Link>

        <Link href="/match" className={CARD}>
          <div className={EYEBROW}>두 사람의 관계</div>
          <div className={TITLE}>궁합</div>
          <p className={DESC}>한 사람과 나의 관계를 자세히 살펴봐요.</p>
          <span className={CTA}>궁합 보기 →</span>
          <span aria-hidden className={ART}>
            <Dot
              size={26}
              style="relative z-[2] border-[1.5px] border-slate-900"
            />
            <span className="-ml-[13px] h-[26px] w-[26px] flex-none rounded-full border-[1.5px] border-dashed border-slate-300" />
          </span>
        </Link>
      </div>
    </section>
  );
}
