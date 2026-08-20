import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { BrandLogo } from "@/components/BrandLogo";

interface FooterCtaProps {
  /** 로그인하지 않았으면 null. CTA 문구가 갈린다. */
  displayName: string | null;
}

/**
 * 마지막 CTA + 푸터.
 *
 * 시안의 푸터는 로고 한 줄과 태그라인뿐이지만 법률 링크와 사업자정보는 그대로 둔다 —
 * 통신판매업자는 이 정보를 초기 화면에 노출할 의무가 있고, 랜딩이 그 자리다.
 * 어두운 배경이라 로고는 light 톤, 본문은 흰색 알파로 낮춰 쓴다.
 */
export function FooterCta({ displayName }: FooterCtaProps) {
  return (
    <section className="bg-slate-900 text-white">
      <div className="mx-auto max-w-[1120px] px-5 py-[clamp(64px,9vw,96px)] text-center md:px-8">
        <h2 className="mb-[18px] text-[clamp(30px,4.4vw,50px)] font-bold leading-[1.12] tracking-[-0.035em]">
          나를 알아가는
          <br />
          첫 걸음부터
        </h2>
        <p className="mb-[38px] text-[clamp(16px,2vw,18px)] text-slate-400 [text-wrap:pretty]">
          생년월일만 입력하면 내 캐릭터부터 확인할 수 있어요. 무료입니다.
        </p>
        <Link
          href={displayName === null ? "/funnel?step=name" : "/home"}
          className="inline-block rounded-[15px] bg-accent px-[34px] py-[17px] text-[17px] font-semibold text-white shadow-[0_16px_40px_-12px_rgba(37,99,235,.5)] hover:bg-accent-700"
        >
          {displayName === null ? "시작하기" : "내 사주 보기"}
        </Link>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3.5 px-5 py-7 md:px-8">
          <BrandLogo size="xs" tone="light" />
          <nav className="flex items-center gap-4 text-[13px] text-slate-400">
            <Link href="/terms" className="hover:text-white">
              이용약관
            </Link>
            <Link href="/privacy" className="font-semibold hover:text-white">
              개인정보처리방침
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-[1120px] space-y-0.5 px-5 pb-9 text-[12.5px] leading-6 text-slate-500 md:px-8">
          <p>
            {COMPANY.name} · 대표 {COMPANY.ceo} · 사업자등록번호 {COMPANY.registrationNumber} ·
            통신판매업신고 {COMPANY.mailOrderSalesNumber}
          </p>
          <p>{COMPANY.address}</p>
          <p>
            문의{" "}
            <a href={`mailto:${COMPANY.contactEmail}`} className="hover:text-white">
              {COMPANY.contactEmail}
            </a>
          </p>
          <p className="pt-1 text-slate-600">사주를, 나를 이해하는 언어로.</p>
        </div>
      </div>
    </section>
  );
}
