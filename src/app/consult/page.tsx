import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { listConsultations } from "@/lib/consultations/store";
import { toListEntry } from "./_lib/to-list-entry";
import { ConsultationList } from "./_components/ConsultationList";
import { StartConsultation } from "./_components/StartConsultation";

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

  const profiles = await listProfiles(session.userId, "self");
  if (profiles.length === 0) redirect("/funnel?step=name");

  const sp = await searchParams;
  const param = parseProfileParam(sp);
  const profileId = param.kind === "id" ? param.id : profiles[0].id;

  const rows = await listConsultations(session.userId);
  const now = new Date();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[560px] px-5 py-6">
        {/* 헤더 우측의 "이용권 N장"은 getBalance 가 실제로 배선된 뒤에 켠다.
            스텁이 돌려주는 0 을 "0장"이라고 보여주면 거짓말이 된다. */}
        <h1 className="mb-5 text-[19px] font-bold tracking-[-0.03em]">고민상담</h1>
        <StartConsultation profileId={profileId} />
        <ConsultationList entries={rows.map((r) => toListEntry(r, now))} />
      </div>
    </div>
  );
}
