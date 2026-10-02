import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { getUser } from "@/lib/auth/users";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { createMap, getMapByProfile } from "@/lib/maps/store";
import { pickMapProfile } from "./_lib/pick-map-profile";

/**
 * 내 지도로 보내는 문. 렌더하는 것이 없다.
 *
 * GET 이 행을 만드는 것이 걸리지만, maps_profile 유니크 인덱스와 createMap 의
 * 읽기-삽입-읽기 덕에 멱등하다. 새로고침해도 지도가 늘지 않는다.
 *
 * 지도는 프로필을 만들 때가 아니라 **여기 들어올 때** 생긴다. 프로필 20개를
 * 저장했다고 빈 지도 20개와 쓰이지 않을 공유 링크 20개를 미리 만들어 둘 이유가
 * 없고, 그중에는 중심이 안 서는 것도 섞인다.
 */
export default async function MapEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  // 프로필을 먼저 확정하고 그 다음에 지도를 찾는다. 예전에는 getMapByOwner 가
  // 맨 앞에 있어 프로필을 아예 안 보고 끝났고, 그래서 홈에서 사람을 바꿔도
  // 같은 지도가 열렸다.
  const [profiles, user, sp] = await Promise.all([
    listProfiles(session.userId),
    getUser(session.userId),
    searchParams,
  ]);

  // invalid 를 absent 와 같이 다룬다 — 지도는 리포트와 달리 "남의 것을 보고
  // 있다" 는 오해가 생길 화면이 아니라, 404 로 끊는 것보다 내 지도로 보내는
  // 편이 낫다.
  const param = parseProfileParam(sp);
  const mine = pickMapProfile({
    asked: param.kind === "id" ? param.id : null,
    primaryId: user?.primaryProfileId ?? null,
    profiles,
    toBirth: (p) => ({
      year: p.birth.year,
      month: p.birth.month,
      day: p.birth.day,
      calendar: p.calendar,
      isLeapMonth: p.isLeapMonth,
    }),
  });

  // 하나도 중심이 안 서면 프로필이 아예 없는 것과 같은 상황이다 — 여기 있는
  // 것으로는 지도를 세울 수 없다. 그러니 같은 곳으로 보낸다.
  if (!mine) redirect("/funnel?step=name");

  const existing = await getMapByProfile(mine.id);
  if (existing) redirect(`/map/${existing.shareId}`);

  const map = await createMap(session.userId, mine.id, {
    name: mine.name,
    year: mine.birth.year,
    month: mine.birth.month,
    day: mine.birth.day,
    calendar: mine.calendar,
    isLeapMonth: mine.isLeapMonth,
  });

  redirect(`/map/${map.shareId}`);
}
