import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { MAX_PROFILES, listProfiles } from "@/lib/profiles/store";
import { countCaption, toProfileCard } from "./_lib/to-profile-card";
import { HomeHeader } from "./_components/HomeHeader";
import { ProfileCard } from "./_components/ProfileCard";
import { AddProfileButton } from "./_components/AddProfileButton";
import { EmptyState } from "./_components/EmptyState";

// report/_lib/access.ts 에 같은 이름의 헬퍼가 있지만 리포트 전용 파일이라 여기서
// import 하지 않는다(레이어를 가로지른다) — 짧으니 그대로 복제한다.
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = first(sp.error);
  const session = await getSession();
  if (!session) redirect("/login?next=/home");

  const [user, rows] = await Promise.all([
    getUser(session.userId),
    listProfiles(session.userId),
  ]);
  const cards = rows.map(toProfileCard);
  const isFull = cards.length >= MAX_PROFILES;
  const displayName = resolveDisplayName(user);

  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      <HomeHeader displayName={displayName} />

      <main className="mx-auto max-w-[880px] px-6 pb-24 pt-[clamp(36px,6vw,64px)]">
        {error === "limit" && (
          // 퍼널의 409 와 로그인 시 드래프트 승격 실패가 둘 다 여기로 온다.
          // 설명 없이 목록만 보여주면 사용자는 왜 돌아왔는지 모른다.
          <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-700">
            프로필이 가득 찼어요. 하나를 지우면 새로 저장할 수 있어요.
          </p>
        )}
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
