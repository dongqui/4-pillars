import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getMapByShareId, listMapPeople } from "@/lib/maps/store";
import { centerOf, dayPillarOf, toMapPerson } from "../_lib/to-map-people";
import { MapShell } from "../_components/MapShell";

type Params = { params: Promise<{ share: string }> };

/**
 * 이 라우트가 쓰는 지도 전부. generateMetadata 와 페이지가 같은 것을 봐야 한다 —
 * 따로 읽으면 (1) 요청 하나에 DB 왕복이 두 배가 되고 (2) 두 곳의 판정이 갈려
 * 본문은 404 인데 <title> 에는 주인 이름이 남는 일이 생긴다.
 *
 * cache() 는 한 요청 안에서만 유효하다 — 요청 사이에 지도를 캐싱하지 않는다.
 */
const loadMap = cache(async (shareId: string) => {
  const map = await getMapByShareId(shareId);
  if (!map) return null;

  // center 는 돌려주지 않고 관문으로만 쓴다. 화면의 중심 노드는 이름 대신
  // "나" 를 그리므로(SelfCore) MapShell 이 이 값을 받을 일이 없다 — 그래도
  // 세워는 봐야 한다. 아래 판정이 그것 때문에 있다.
  const center = centerOf(map.center.name, map.center);
  const centerDay = dayPillarOf(map.center);
  // 중심을 못 세우면 지도가 성립하지 않는다. 없는 지도와 똑같이 다룬다 —
  // 제목만 살아남으면 그것이 곧 "이 링크는 실재한다"는 신호가 된다.
  if (!center || !centerDay) return null;

  const rows = await listMapPeople(map.id);
  // 계산되지 않는 사람은 조용히 뺀다 — 한 명 때문에 지도 전체가 500 이 되면 안 된다.
  const people = rows
    .map((row) => toMapPerson(centerDay, row))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return { map, people };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { share } = await params;
  const loaded = await loadMap(share);
  if (!loaded) return { title: "관계 지도" };

  const { map, people } = loaded;
  return {
    title: `${map.center.name}님의 관계 지도`,
    description: `${people.length}명이 있는 관계 지도예요.`,
    // 링크를 아는 사람만 보는 것이 전제다. 검색에 잡히면 그 전제가 깨진다.
    robots: { index: false, follow: false },
  };
}

export default async function MapPage({ params }: Params) {
  const { share } = await params;

  const loaded = await loadMap(share);
  if (!loaded) notFound();

  const { map, people } = loaded;
  const session = await getSession();

  return (
    <MapShell
      people={people}
      isOwner={session?.userId === map.ownerUserId}
      shareId={map.shareId}
      loggedIn={session !== null}
    />
  );
}
