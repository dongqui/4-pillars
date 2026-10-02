import type { BirthLite } from "@/lib/maps/types";
import { pickMapCenter } from "./to-map-people";

/**
 * 어느 프로필의 지도를 열 것인가.
 *
 * 페이지(`map/page.tsx`)가 아니라 여기 있는 이유는 테스트다 — 라우트 컴포넌트는
 * 세션·DB 를 끌고 와서 단위 테스트가 안 되는데, 고르는 규칙 자체는 순수하다.
 *
 * 세 번 물러선다: 요청한 프로필 → primary → 중심이 서는 가장 오래된 프로필.
 * 어느 단계든 **중심이 실제로 서는지**(일주가 세워지는지)를 함께 본다. 중심이
 * 안 서는 프로필로 지도를 만들면 /map/[share] 가 영구 404 가 되고, 그 뒤로는
 * 지도가 이미 있으므로 다시 들어와도 같은 404 다 — 지도를 고치거나 지우는 길이
 * 아직 없어서 DB 를 손으로 지워야 풀린다.
 *
 * `profiles` 는 listProfiles 의 결과, 즉 **홈에서 고를 수 있는 사람들**이다
 * (kind='saved' 이고 안 지워진 것). 남의 id·temp·지워진 id 가 asked 로 와도
 * 목록에 없으므로 한 갈래로 합쳐져 primary 로 떨어진다.
 *
 * ⚠️ 입력은 **최신순**이다(listProfiles 의 ORDER BY created_at DESC). 그래서
 * 가장 오래된 것은 배열의 끝이고, pickMapCenter 가 뒤에서부터 훑는다.
 */
export function pickMapProfile<T extends { id: string }>({
  asked,
  primaryId,
  profiles,
  toBirth,
}: {
  /** ?profile 로 들어온 id. 없거나 형식이 틀리면 null */
  asked: string | null;
  /** users.primary_profile_id */
  primaryId: string | null;
  /** listProfiles 결과 — 최신순 */
  profiles: readonly T[];
  toBirth: (p: T) => BirthLite;
}): T | null {
  const wanted = asked === null ? [] : profiles.filter((p) => p.id === asked);
  const primary = primaryId === null ? [] : profiles.filter((p) => p.id === primaryId);
  return (
    pickMapCenter(wanted, toBirth) ??
    pickMapCenter(primary, toBirth) ??
    pickMapCenter(profiles, toBirth)
  );
}
