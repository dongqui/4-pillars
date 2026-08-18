import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getMapByShareId, listMapPeople } from "@/lib/maps/store";
import { centerOf, dayPillarOf, toMapPerson } from "../_lib/to-map-people";
import { MapShell } from "../_components/MapShell";

type Params = { params: Promise<{ share: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { share } = await params;
  const map = await getMapByShareId(share);
  if (!map) return { title: "관계 지도" };

  const people = await listMapPeople(map.id);
  return {
    title: `${map.center.name}님의 관계 지도`,
    description: `${people.length}명이 있는 관계 지도예요.`,
    // 링크를 아는 사람만 보는 것이 전제다. 검색에 잡히면 그 전제가 깨진다.
    robots: { index: false, follow: false },
  };
}

export default async function MapPage({ params }: Params) {
  const { share } = await params;

  const map = await getMapByShareId(share);
  if (!map) notFound();

  const center = centerOf(map.center.name, map.center);
  const centerDay = dayPillarOf(map.center);
  // 중심을 못 세우면 지도가 성립하지 않는다. 만세력이 못 세우는 값이 지도로
  // 들어올 길은 없지만(퍼널이 이미 걸렀다), 없는 지도와 같이 다룬다.
  if (!center || !centerDay) notFound();

  const rows = await listMapPeople(map.id);
  // 계산되지 않는 사람은 조용히 뺀다 — 한 명 때문에 지도 전체가 500 이 되면 안 된다.
  const people = rows
    .map((row) => toMapPerson(centerDay, row))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const session = await getSession();

  return (
    <MapShell
      people={people}
      center={center}
      isOwner={session?.userId === map.ownerUserId}
      shareId={map.shareId}
    />
  );
}
