import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { getUser } from "@/lib/auth/users";
import { toPersonOption } from "./_lib/to-person-option";
import { MatchForm } from "./_components/MatchForm";
import { NoSubjectFallback } from "./_components/NoSubjectFallback";

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
  const [profiles, user] = await Promise.all([
    listProfiles(session.userId),
    getUser(session.userId),
  ]);
  const people = profiles.map(toPersonOption);
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
      {hasSubject ? (
        <MatchForm people={people} defaultSubjectId={defaultSubjectId} />
      ) : (
        <NoSubjectFallback />
      )}
    </div>
  );
}
