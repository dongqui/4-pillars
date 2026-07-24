import Link from "next/link";
import { cookies } from "next/headers";

type ProviderId = "kakao" | "line" | "google";

const PROVIDERS: { id: ProviderId; label: string; className: string; icon: React.ReactNode }[] = [
  {
    id: "kakao",
    label: "카카오로 계속하기",
    className: "bg-[#FEE500] text-black/85 hover:brightness-[.97]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path fill="#191919" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5c-.08.31.27.56.54.38l4.18-2.77c.51.05 1.03.08 1.57.08 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "LINE으로 계속하기",
    className: "bg-[#06C755] text-white hover:brightness-[.96]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path fill="#fff" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5c-.08.31.27.56.54.38l4.18-2.77c.51.05 1.03.08 1.57.08 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    id: "google",
    label: "Google로 계속하기",
    className: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const lastProvider = (await cookies()).get("last_provider")?.value;
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-slate-900 text-[15px] font-semibold text-white">
            사
          </div>
          <span className="text-base font-semibold tracking-tight">사주</span>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-400 hover:text-slate-600">
          ← 돌아가기
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 pb-20 sm:px-8">
        <div className="w-full max-w-[380px] text-center">
          <h1 className="mb-2.5 text-2xl font-bold leading-snug tracking-tight [word-break:keep-all] sm:text-[28px]">
            사주에 오신 걸 환영해요
          </h1>
          <p className="mb-9 text-[15px] text-slate-400 [word-break:keep-all]">
            간편 로그인으로 3초 만에 시작하세요.
            <br />
            처음이라면 자동으로 가입돼요.
          </p>

          {error === "oauth" && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-600">
              로그인에 실패했어요. 다시 시도해 주세요.
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            {PROVIDERS.map((p) => (
              <a
                key={p.id}
                href={`/api/auth/login/${p.id}${nextQuery}`}
                className={`relative flex h-[52px] items-center justify-center rounded-[14px] text-[15px] font-semibold transition ${p.className}`}
              >
                <span className="absolute left-[18px] flex">{p.icon}</span>
                {p.label}
                {lastProvider === p.id && (
                  <span className="absolute right-3.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
                    최근 로그인
                  </span>
                )}
              </a>
            ))}
          </div>

          <p className="mt-7 text-[12.5px] leading-[1.7] text-slate-400 [word-break:keep-all]">
            계속하면 사주의{" "}
            <a href="#" className="text-slate-500 underline">
              이용약관
            </a>{" "}
            및{" "}
            <a href="#" className="text-slate-500 underline">
              개인정보 처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </p>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] text-slate-300">
            🔒 입력하신 출생 정보는 안전하게 보관돼요
          </p>
        </div>
      </div>
    </main>
  );
}
