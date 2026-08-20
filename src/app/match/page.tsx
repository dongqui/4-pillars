import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { HomeLink } from "@/components/HomeLink";
import { listProfiles } from "@/lib/profiles/store";
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

  // "all" 이다 — 궁합 상대로 저장된 사람(kind='other')도 다시 고를 수 있어야 한다.
  const profiles = await listProfiles(session.userId, "all");
  const people = profiles.map(toPersonOption);
  // 내 사주(kind='self')가 하나도 없으면 "나"로 고를 게 없다 — 폼을 아예 내려보내지
  // 않는다(home/page.tsx 가 entries.length===0 일 때 EmptyState 를 고르는 것과 같은 자리).
  const hasSubject = people.some((p) => p.kind === "self");

  return (
    <div className="min-h-screen flex-1 bg-white">
      {/* 폼과 폴백 둘 다 헤더가 없다 — 나가는 길은 page 가 갖는다.
          결과 화면(/match/[id])의 MatchShell 헤더와 같은 자리다. */}
      <div className="mx-auto max-w-[560px] px-5 pt-6 md:px-8">
        <HomeLink />
      </div>
      {hasSubject ? <MatchForm people={people} /> : <NoSubjectFallback />}
    </div>
  );
}
