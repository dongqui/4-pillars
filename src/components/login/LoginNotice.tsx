import Link from "next/link";

export function LoginNotice() {
  return (
    <div>
      <p className="text-[12.5px] text-slate-400 leading-[1.7] mt-7 break-keep">
        계속하면 사주의{" "}
        <Link
          href="/terms"
          className="text-slate-500 underline hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          이용약관
        </Link>{" "}
        및{" "}
        <Link
          href="/privacy"
          className="text-slate-500 underline hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          개인정보 처리방침
        </Link>
        에 동의하는 것으로 간주됩니다.
      </p>
      <p className="text-[12.5px] text-[#C7CBD1] mt-2.5 flex items-center justify-center gap-1.5">
        🔒 입력하신 출생 정보는 안전하게 보관돼요
      </p>
    </div>
  );
}
