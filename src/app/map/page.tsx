import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { createMap, getMapByOwner } from "@/lib/maps/store";
import { pickMapCenter } from "./_lib/to-map-people";

/**
 * 내 지도로 보내는 문. 렌더하는 것이 없다.
 *
 * GET 이 행을 만드는 것이 걸리지만, maps_owner_user 유니크 인덱스와 createMap 의
 * 읽기-삽입-읽기 덕에 멱등하다. 새로고침해도 지도가 늘지 않는다.
 */
export default async function MapEntryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  const existing = await getMapByOwner(session.userId);
  if (existing) redirect(`/map/${existing.shareId}`);

  // "가장 먼저 만든 것" 이 임의 선택이 아닌 이유: 퍼널을 통과하며 만든 본인 사주가
  // 그 자리이고, 드래프트 승격도 첫 행이 되므로 로그인 전후가 같은 사람을 가리킨다.
  //
  // ⚠️ 다만 "가장 오래된 것" 을 그냥 집으면 안 된다. profiles/input.ts 의 스키마는
  // 만세력(1900~2050)보다 헐거워서 2200년·2월 31일·없는 윤달이 저장될 수 있고,
  // 그런 프로필로 지도를 만들면 /map/[share] 가 중심을 못 세워 영구 404 가 된다.
  // 그 뒤로는 getMapByOwner 가 그 행을 먼저 돌려주므로 다시 들어와도 같은 404 이고,
  // 이 브랜치에는 지도를 고치거나 지우는 길이 없다 — DB 를 손으로 지워야 풀린다.
  //
  // 그래서 오래된 것부터 훑어 **중심이 실제로 서는** 첫 프로필을 고른다.
  // listProfiles 는 최신순(created_at DESC)이라 오래된 순은 뒤에서부터다.
  const profiles = await listProfiles(session.userId, "self");
  const mine = pickMapCenter(profiles, (p) => ({
    year: p.birth.year,
    month: p.birth.month,
    day: p.birth.day,
    calendar: p.calendar,
    isLeapMonth: p.isLeapMonth,
  }));
  // 하나도 중심이 안 서면 프로필이 아예 없는 것과 같은 상황이다 — 여기 있는 것으로는
  // 지도를 세울 수 없다. 그러니 같은 곳으로 보낸다.
  if (!mine) redirect("/funnel?step=name");

  // 여기 도달했다는 것은 중심이 서는 프로필을 손에 쥐었다는 뜻이다. createMap 은
  // 그 뒤에만 부른다 — 열 수 없는 지도를 만들어 두면 되돌릴 방법이 없다.
  const map = await createMap(session.userId, {
    name: mine.name,
    year: mine.birth.year,
    month: mine.birth.month,
    day: mine.birth.day,
    calendar: mine.calendar,
    isLeapMonth: mine.isLeapMonth,
  });

  redirect(`/map/${map.shareId}`);
}
