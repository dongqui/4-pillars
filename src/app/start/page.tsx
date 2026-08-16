import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { StartForm } from "./_components/StartForm";

export const metadata: Metadata = {
  title: "내 캐릭터 알아보기 · 프로젝트 사주",
  description: "생년월일 하나로 60개의 캐릭터 중 나에게 해당하는 한 장을 받아보세요.",
};

/**
 * 라이트 퍼널 1스텝. 시각·출생지·성별을 묻지 않는다 — 캐릭터는 일주로만 정해진다.
 * 시간까지 받는 다섯 스텝 퍼널(/funnel)은 유료 리포트용으로 그대로 남는다.
 */
export default async function StartPage() {
  // 이미 저장한 프로필이 있는 사람에게는 다시 입력하지 않는 길을 알려준다.
  // 막지는 않는다 — 다른 사람의 캐릭터를 보러 왔을 수도 있다.
  const session = await getSession();
  let hasProfiles = false;
  if (session) {
    try {
      hasProfiles = (await listProfiles(session.userId)).length > 0;
    } catch (e) {
      // 이 안내는 없어도 되는 정보다. DB 가 흔들려도 입력은 막지 않는다.
      console.error("[start] listProfiles", e instanceof Error ? e.message : e);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 justify-center bg-white md:items-center md:bg-slate-100 md:px-6 md:py-14">
      <div className="w-full bg-white px-[22px] pb-10 pt-[54px] md:max-w-[460px] md:rounded-3xl md:border md:border-slate-200 md:px-[34px] md:py-8 md:shadow-[0_24px_60px_-30px_rgba(15,23,42,.3)]">
        <StartForm />
        {hasProfiles && (
          <p className="mt-5 text-center text-[13px] text-slate-400">
            이미 저장한 프로필이 있어요.{" "}
            <Link href="/home" className="font-semibold text-accent hover:underline">
              홈에서 보기
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
