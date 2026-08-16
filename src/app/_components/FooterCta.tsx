import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * 마지막 CTA + 푸터.
 *
 * 시안의 푸터는 로고 한 줄뿐이지만 법률 링크와 사업자정보는 그대로 둔다 —
 * 통신판매업자는 이 정보를 초기 화면에 노출할 의무가 있고, 랜딩이 그 자리다.
 */
export function FooterCta() {
  return (
    <section>
      <div className="mx-auto max-w-[720px] px-5 pb-[76px] pt-[68px] text-center md:px-8 md:py-[clamp(88px,9vw,120px)]">
        <h2 className="mb-4 text-[clamp(28px,4vw,42px)] font-bold leading-[1.14] tracking-[-0.035em] [text-wrap:balance]">
          먼저 내 캐릭터부터
          <br />
          만나볼까요?
        </h2>
        <p className="mb-8 text-[16.5px] text-gray-400 [text-wrap:pretty]">
          생년월일만 있으면 됩니다.
        </p>
        <Link
          href="/start"
          className="inline-block rounded-[14px] bg-accent px-8 py-[17px] text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,.55)] hover:bg-accent-700"
        >
          내 캐릭터 알아보기
        </Link>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3.5 px-5 py-7 md:px-8">
          <BrandLogo size="xs" />
          <nav className="flex items-center gap-4 text-[13px] text-slate-500">
            <Link href="/terms" className="hover:text-slate-900">
              이용약관
            </Link>
            <Link href="/privacy" className="font-semibold hover:text-slate-900">
              개인정보처리방침
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-[1120px] space-y-0.5 px-5 pb-9 text-[12.5px] leading-6 text-slate-400 md:px-8">
          <p>
            {COMPANY.name} · 대표 {COMPANY.ceo} · 사업자등록번호 {COMPANY.registrationNumber} ·
            통신판매업신고 {COMPANY.mailOrderSalesNumber}
          </p>
          <p>{COMPANY.address}</p>
          <p>
            문의{" "}
            <a href={`mailto:${COMPANY.contactEmail}`} className="hover:text-slate-900">
              {COMPANY.contactEmail}
            </a>
          </p>
          <p className="pt-1 text-slate-300">나와 주변을 발견해가는 가장 차분한 방법.</p>
        </div>
      </div>
    </section>
  );
}
