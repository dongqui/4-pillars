import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { MAX_PROFILES, listProfiles } from "@/lib/profiles/store";
import { countCaption, toProfileCard } from "./_lib/to-profile-card";
import { HomeHeader } from "./_components/HomeHeader";
import { ProfileCard } from "./_components/ProfileCard";
import { AddProfileButton } from "./_components/AddProfileButton";
import { EmptyState } from "./_components/EmptyState";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/home");

  const [user, rows] = await Promise.all([
    getUser(session.userId),
    listProfiles(session.userId),
  ]);
  const cards = rows.map(toProfileCard);
  const isFull = cards.length >= MAX_PROFILES;
  // 소셜 제공자가 이름을 주지 않는 경우가 있다.
  const displayName = user?.displayName?.trim() || "회원";

  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      <HomeHeader displayName={displayName} />

      <main className="mx-auto max-w-[880px] px-6 pb-24 pt-[clamp(36px,6vw,64px)]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="mb-2 text-[clamp(26px,4vw,34px)] font-bold tracking-[-0.035em]">
              저장된 프로필
            </h1>
            <p className="text-[15px] text-slate-400">{countCaption(cards)}</p>
          </div>

          {cards.length > 0 && (
            <div className="flex items-center gap-2.5 text-[13px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                전체 리포트
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                무료 리포트
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {cards.length === 0 ? (
            <EmptyState />
          ) : (
            cards.map((card) => <ProfileCard key={card.id} card={card} />)
          )}
          <AddProfileButton disabled={isFull} />
        </div>

        {cards.length > 0 && (
          <p className="mt-[22px] text-[13px] text-slate-400 [text-wrap:pretty]">
            {isFull
              ? `프로필 ${MAX_PROFILES}개를 모두 사용했어요. 결제한 리포트는 계정에 계속 보관됩니다.`
              : `프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있어요. 결제한 리포트는 계정에 계속 보관됩니다.`}
          </p>
        )}
      </main>
    </div>
  );
}
