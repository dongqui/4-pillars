import Link from "next/link";
import { TICKET_PRICE_LABEL } from "../_lib/catalog";
import { ReportPreview } from "./ReportPreview";

interface HeroProps {
  /** 로그인하지 않았으면 null. page.tsx 가 폴백까지 끝내고 넘긴다. */
  displayName: string | null;
}

const PRIMARY =
  "rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white shadow-[0_12px_28px_-8px_rgba(37,99,235,.4)] hover:bg-accent-700";
const SECONDARY =
  "rounded-[14px] border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 hover:bg-slate-50";

export function Hero({ displayName }: HeroProps) {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-[72px] pt-[clamp(56px,9vw,120px)] text-center md:px-8">
      <div className="mb-[30px] inline-flex items-center rounded-full bg-accent-50 px-3.5 py-[7px] text-[13.5px] font-semibold text-accent">
        사주를, 나를 이해하는 언어로
      </div>
      <h1 className="mb-[26px] text-[clamp(40px,7vw,78px)] font-bold leading-[1.04] tracking-[-0.045em]">
        당신은
        <br />
        어떤 사람인가요?
      </h1>
      <p className="mx-auto mb-3.5 max-w-[560px] text-[clamp(19px,2.4vw,23px)] font-medium leading-[1.5] text-slate-700 [text-wrap:pretty]">
        한 번에 다 알 필요는 없어요. 알고 싶은 것부터 하나씩.
      </p>
      <p className="mx-auto mb-[30px] max-w-[460px] text-[16.5px] leading-[1.6] text-slate-400 [text-wrap:pretty]">
        내 캐릭터와 관계 지도는{" "}
        <strong className="whitespace-nowrap font-semibold text-slate-600">무료</strong>. 더 깊이
        보고 싶은 것만{" "}
        <strong className="whitespace-nowrap font-semibold text-slate-600">
          개당 {TICKET_PRICE_LABEL}
        </strong>
        .
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {displayName === null ? (
          <Link href="/funnel?step=name" className={PRIMARY}>
            내 리포트 만들기
          </Link>
        ) : (
          <>
            <Link href="/home" className={PRIMARY}>
              내 사주 보기
            </Link>
            <Link href="/funnel?step=name" className={SECONDARY}>
              다른 사람 사주 보기
            </Link>
          </>
        )}
      </div>
      {displayName !== null && (
        <p className="mt-4 text-[13.5px] text-slate-400">
          {displayName}님, 다시 오셨네요 — 지난 사주가 저장되어 있어요.
        </p>
      )}

      <ReportPreview />
    </section>
  );
}
