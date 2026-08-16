import Link from "next/link";

/**
 * 시안에 없는 화면. 프로필도 익명 캐릭터도 없는 상태로 홈에 닿는 길이 있다 —
 * 로그인 직후 첫 방문, 쿠키 만료, 홈 주소 직접 입력.
 */
export function EmptyState() {
  return (
    <section className="mx-auto max-w-[780px] px-5 pb-16 pt-14 text-center md:px-8">
      <p className="mb-2 text-[19px] font-bold tracking-[-0.025em]">아직 캐릭터가 없어요</p>
      <p className="mb-7 text-[14.5px] text-slate-400 [text-wrap:pretty]">
        생년월일 하나면 예순 개의 캐릭터 중 한 장을 받아볼 수 있어요.
      </p>
      <Link
        href="/start"
        className="inline-block rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.9)] hover:bg-accent-700"
      >
        내 캐릭터 알아보기
      </Link>
    </section>
  );
}
