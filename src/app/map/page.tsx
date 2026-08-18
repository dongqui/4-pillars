import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { createMap, getMapByOwner } from "@/lib/maps/store";

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
  const profiles = await listProfiles(session.userId, "self");
  const mine = profiles[profiles.length - 1]; // listProfiles 는 최신순이다
  if (!mine) redirect("/funnel?step=name");

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
