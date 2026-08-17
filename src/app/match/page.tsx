import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { toPersonOption } from "./_lib/to-person-option";
import { MatchForm } from "./_components/MatchForm";

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

  return (
    <div className="min-h-screen flex-1 bg-white">
      <MatchForm people={people} />
    </div>
  );
}
