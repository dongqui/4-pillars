import Link from "next/link";

/**
 * /match 는 로그인만 요구한다(page.tsx) — 퍼널을 한 번도 끝내지 않아 저장한 사람이
 * 하나도 없는 채로도 닿을 수 있다. page.tsx 가 이 경우를 미리 걸러 MatchForm(과 그
 * 아래 PersonSelect/RelationPicker)의 클라이언트 JS를 아예 내려보내지 않는다 —
 * 어차피 쓸 수 없는 폼이다.
 */
export function NoSubjectFallback() {
  return (
    <div className="mx-auto max-w-[560px] px-5 py-16 text-center md:px-8">
      <p className="mb-2 text-[19px] font-bold tracking-[-0.025em]">먼저 내 사주를 저장해 주세요</p>
      <p className="mb-7 text-[14.5px] text-slate-400 [text-wrap:pretty]">
        궁합은 내 사주와 상대의 사주를 함께 봐요.
      </p>
      <Link
        href="/funnel?step=name"
        className="inline-block rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.9)] hover:bg-accent-700"
      >
        내 사주 저장하기
      </Link>
    </div>
  );
}
