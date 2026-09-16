import Link from "next/link";
import { loginHref } from "@/lib/nav/next-param";

/**
 * 비로그인 생성 한도에 걸렸을 때. 실패가 아니라 "잠시 기다리거나 로그인하면 된다"라서
 * ReportError 와 문구를 나눈다 — 다시 시도 버튼만 주면 눌러도 같은 화면이 나온다.
 */
export function ReportRateLimited() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">잠시 후에 다시 열어주세요</div>
      <p className="mt-3 max-w-[400px] text-[15px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
        짧은 시간에 리포트를 너무 많이 만들었어요. 한 시간 뒤에 다시 시도하거나, 로그인하면 지금
        이어서 볼 수 있어요.
      </p>
      {/* 로그인하면 드래프트가 프로필로 승격되고, 콜백이 행선지를
          /report?profile=<새 id> 로 덮는다 — 여기서 id 를 알 필요가 없다.
          같은 화면의 LockedSections 도 같은 값을 쓴다. */}
      <Link
        href={loginHref("/report")}
        className="mt-7 rounded-xl bg-accent px-5 py-[11px] text-[14.5px] font-semibold text-white hover:bg-accent-700"
      >
        로그인하고 이어서 보기
      </Link>
    </div>
  );
}
