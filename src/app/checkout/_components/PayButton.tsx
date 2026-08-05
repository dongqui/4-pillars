"use client";

/**
 * 결제 시작 버튼. 인라인(데스크톱)과 하단 고정 바(모바일) 두 곳에서 쓴다.
 *
 * 지금은 눌러도 아무 일도 하지 않는다 — PG 연동(ISSUE-014)이 붙기 전이라 화면만 있다.
 * onClick 이 붙는 자리가 여기 하나뿐이도록 두 곳이 이 컴포넌트를 공유한다.
 */
export function PayButton({
  agreed,
  label,
  className = "",
}: {
  agreed: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!agreed}
      // TODO(ISSUE-014): PortOne 결제창 호출 → purchases 행 생성 → 리포트로 복귀.
      className={`rounded-[14px] py-4 text-base font-bold tracking-[-0.01em] transition-opacity ${
        agreed
          ? "cursor-pointer bg-accent text-white hover:opacity-[.92]"
          : "cursor-not-allowed bg-slate-100 text-slate-400"
      } ${className}`}
    >
      {label}
    </button>
  );
}
