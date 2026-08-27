import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { listProfiles } from "@/lib/profiles/store";
import { listMatches } from "@/lib/matches/store";
import { getUser } from "@/lib/auth/users";
import { toPersonOption } from "./_lib/to-person-option";
import { toPastMatchView } from "./_lib/to-past-match";
import { MatchForm } from "./_components/MatchForm";
import { NoSubjectFallback } from "./_components/NoSubjectFallback";
import { PastMatches } from "./_components/PastMatches";

export const metadata: Metadata = { title: "궁합 · 프로젝트 사주" };

/**
 * 궁합 입력. 한 화면에서 나 · 상대 · 관계를 한 번에 받는다 —
 * 퍼널처럼 스텝을 나누지 않는다 (피벗의 "입력을 한 번만 받는다").
 *
 * 로그인을 요구한다. 궁합은 이용권을 쓰는 상품이라 계정 없이는 성립하지 않고,
 * 저장된 사람 목록에서 상대를 고르는 것도 계정이 있어야 한다.
 */
export default async function MatchPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/match");

  // 저장한 사람 전부다. 나 칸과 상대 칸이 같은 목록을 쓴다 — 어느 문으로 들어온
  // 사람인지로 고를 수 있는 칸이 갈리던 구분(kind='other')은 없앴다.
  const [profiles, user, matches] = await Promise.all([
    listProfiles(session.userId),
    getUser(session.userId),
    listMatches(session.userId),
  ]);
  const people = profiles.map(toPersonOption);
  const past = matches.map((m) => toPastMatchView(m));
  // "나" 칸의 기본값도 users 가 답한다. 예전에는 목록의 첫 줄(= 가장 최근에 저장한
  // 사람)이 기본이라, 궁합 한 번 보고 상대를 저장하면 그 다음 방문에서 상대가 "나"
  // 자리에 앉아 있었다 — 상담·지도가 각자 때우던 것과 같은 자리다.
  // 목록에 없는 id 는 넘기지 않는다(지워졌거나 temp 가 된 경우) — MatchForm 이
  // 첫 줄로 물러선다.
  const defaultSubjectId = people.some((p) => p.id === user?.primaryProfileId)
    ? user!.primaryProfileId!
    : null;
  // 저장한 사람이 하나도 없으면 "나"로 고를 게 없다 — 폼을 아예 내려보내지 않는다
  // (home/page.tsx 가 entries.length===0 일 때 EmptyState 를 고르는 것과 같은 자리).
  const hasSubject = people.length > 0;

  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      {/* 폼과 폴백 둘 다 헤더가 없다 — 나가는 길은 page 가 갖는다.
          결과 화면(/match/[id])의 MatchShell 과 같은 AppHeader 다. 안쪽 폭은
          본문(MatchForm)의 max-w-[520px] px-5/md:px-8 에 맞춘다 — 헤더가 더 넓으면
          로고가 본문 왼쪽 끝보다 바깥에 선다. */}
      <AppHeader displayName={resolveDisplayName(user)} inner="max-w-[520px] px-5 md:px-8" />
      {hasSubject ? (
        // 이미 본 궁합은 MatchForm 안으로 넣는다 — 페이지의 가로폭 컨테이너를
        // 그쪽이 갖고 있어서, 밖에 두면 폭과 아래 여백이 어긋난다.
        <MatchForm
          people={people}
          defaultSubjectId={defaultSubjectId}
          defaultOpen={past.length === 0}
        >
          {past.length > 0 && <PastMatches items={past} />}
        </MatchForm>
      ) : (
        <>
          <NoSubjectFallback />
          {/*
            저장한 사람이 없는데 궁합은 있는 상태. 지금은 프로필을 지우는 길이 없어
            닿기 어렵지만, 생기면 바로 닿는다 — 그때 목록까지 같이 사라지면 이미
            이용권을 쓴 결과를 잃는다.
          */}
          {past.length > 0 && (
            <div className="mx-auto max-w-[520px] px-5 pb-24 md:px-8">
              <PastMatches items={past} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
