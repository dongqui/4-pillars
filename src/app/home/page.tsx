import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { readCurrentDraft } from "@/lib/drafts/current";
import { MAX_PROFILES, listProfiles } from "@/lib/profiles/store";
import { toDraftEntry, toHomeEntry, type HomeEntry } from "./_lib/to-home-entry";
import { HomeHeader } from "./_components/HomeHeader";
import { HomeIdentity } from "./_components/HomeIdentity";
import { EmptyState } from "./_components/EmptyState";

export const metadata: Metadata = {
  title: "홈 · 프로젝트 사주",
};

// report/_lib/access.ts 에 같은 이름의 헬퍼가 있지만 리포트 전용 파일이라 여기서
// import 하지 않는다(레이어를 가로지른다) — 짧으니 그대로 복제한다.
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * 피벗 이후의 중심 화면. 프로필 목록 대신 "보고 있는 사주 하나 + 그 캐릭터 + 다음 행선지"다.
 *
 * 로그인을 요구하지 않는다 — 랜딩 → 생년월일 → 리빌 → 홈 흐름이 로그인 벽에서
 * 끊기면 무료 캐릭터로 사람을 모으는 피벗 자체가 성립하지 않는다. 비로그인은
 * 쿠키에 있는 익명 캐릭터 한 장을 본다.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = first(sp.error);
  const session = await getSession();

  let displayName: string | null = null;
  let entries: HomeEntry[] = [];
  let canAdd = true;

  if (session) {
    const [user, rows] = await Promise.all([
      getUser(session.userId),
      listProfiles(session.userId),
    ]);
    displayName = resolveDisplayName(user);
    entries = rows.map(toHomeEntry);
    canAdd = rows.length < MAX_PROFILES;
  }

  // 로그인했는데 프로필이 없는 경우에도 드래프트는 볼 수 있어야 한다(승격이 실패했거나
  // 한도에 걸린 경우). 프로필이 하나라도 있으면 드래프트는 이미 승격됐거나 곧 사라진다.
  if (entries.length === 0) {
    const draft = await readCurrentDraft();
    if (draft) entries = [toDraftEntry(draft)];
  }

  return (
    <div className="min-h-screen flex-1 bg-white">
      <HomeHeader displayName={displayName} />

      {error === "limit" && (
        // 퍼널의 409 와 로그인 시 드래프트 승격 실패가 둘 다 여기로 온다.
        <div className="mx-auto max-w-[780px] px-5 pt-4 md:px-8">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-700">
            프로필이 가득 찼어요. 하나를 지우면 새로 저장할 수 있어요.
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <HomeIdentity entries={entries} canAdd={canAdd} />
      )}
    </div>
  );
}
