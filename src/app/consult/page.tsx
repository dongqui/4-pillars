import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { listProfiles } from "@/lib/profiles/store";
import { toPersonOption } from "@/lib/profiles/option";
import { defaultConsultationSubject } from "@/lib/consultations/subject";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { listConsultations } from "@/lib/consultations/store";
import { getBalance } from "@/lib/tickets/wallet";
import { toListEntry } from "./_lib/to-list-entry";
import { ConsultFrame } from "./_components/ConsultFrame";
import { ConsultBoard } from "./_components/ConsultBoard";
import { ConsultationList } from "./_components/ConsultationList";

export const metadata: Metadata = {
  title: "고민상담 · 프로젝트 사주",
};

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  // 상담은 이용권을 쓰는 기능이라 로그인이 필요하다. 카드 자체는 잠그지 않고
  // 여기서 넘긴다 — 로그인 벽에서 흐름을 끊지 않는 피벗 정책과 같은 이유다.
  if (!session) redirect("/login?next=/consult");

  const profiles = await listProfiles(session.userId);
  if (profiles.length === 0) redirect("/funnel?step=name");

  const sp = await searchParams;
  const param = parseProfileParam(sp);
  // 기본 대상은 "나" 다 — API 가 프로필 없이 열 때 고르는 것과 같아야 한다.
  // 여기만 "최신" 으로 두면 화면이 보여주는 사람과 상담이 실제로 근거 삼는 사람이
  // 갈린다(같은 판단이 두 벌이 되는 자리).
  const fallback = await defaultConsultationSubject(session.userId);
  const asked = param.kind === "id" ? param.id : (fallback?.id ?? profiles[0].id);
  // 목록에 없는 id 는 넘기지 않는다 — 남의 id 나 지워진 id 가 URL 에 있으면
  // 셀렉터는 첫 줄을 보여주는데 POST 는 그 id 를 그대로 들고 가, 화면이 말하는
  // 사람과 상담이 근거 삼는 사람이 갈린다(같은 판단이 두 벌이 되는 자리다).
  const people = profiles.map(toPersonOption);
  const profileId = people.some((p) => p.id === asked) ? asked : people[0].id;

  const [rows, balance, user] = await Promise.all([
    listConsultations(session.userId),
    getBalance(session.userId),
    getUser(session.userId),
  ]);
  const now = new Date();

  return (
    <ConsultFrame displayName={resolveDisplayName(user)}>
      <ConsultBoard
        profileId={profileId}
        people={people}
        balance={balance}
        isEmpty={rows.length === 0}
      >
        <ConsultationList entries={rows.map((r) => toListEntry(r, now))} />
      </ConsultBoard>
    </ConsultFrame>
  );
}
