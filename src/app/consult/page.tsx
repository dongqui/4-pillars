import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
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
  const profileId = param.kind === "id" ? param.id : (fallback?.id ?? profiles[0].id);

  const [rows, balance] = await Promise.all([
    listConsultations(session.userId),
    getBalance(session.userId),
  ]);
  const now = new Date();

  return (
    <ConsultFrame>
      <ConsultBoard profileId={profileId} balance={balance} isEmpty={rows.length === 0}>
        <ConsultationList entries={rows.map((r) => toListEntry(r, now))} />
      </ConsultBoard>
    </ConsultFrame>
  );
}
