/**
 * 생년월일 → 지도 위의 자리.
 *
 * 지도가 쓰는 것은 일주(日柱) 하나뿐이다. 일주는 출생 시각·경도·진태양시 보정과
 * 무관하다 — 396개 날짜 × (시각 5종 + 경도 3종 + 보정 on/off) 에서 달라진 경우가
 * 0이었다(설계 문서 §1.1). 그래서 이 모듈이 받는 것은 연·월·일과 양/음력뿐이다.
 *
 * three 도 DB 도 import 하지 않는다. 이 라우트의 테스트는 node 환경이라
 * 화면 코드를 테스트할 수 없고, 규칙은 전부 여기 같은 순수 모듈로 내려온다.
 */
import {
  buildPillars,
  characterOf,
  getRelation,
  type DayPillarInput,
  type RelationBadge,
  type RelationKind,
} from "@/lib/saju-core";
import type { BirthLite, MapPersonRow } from "@/lib/maps/types";
import type { Feature, RelationRole } from "../_data/roles";
import type { MapCenter, MapPerson } from "../_data/person";

/**
 * 관계 5분류 → 지도의 5구역. 명리 용어를 그대로 옮긴 것이라 임의 매핑이 아니다.
 * 생아=인성, 비아=비겁, 아생=식상, 아극=재성, 극아=관성.
 */
const ROLE_OF: Record<RelationKind, RelationRole> = {
  생아: "fill",
  비아: "beside",
  아생: "express",
  아극: "move",
  극아: "refine",
};

/**
 * 배지 → 소구역. 동일일주가 여기 없는 것은 의도다 — 六合 도 沖 도 아니므로
 * 기본으로 접고, 그 사실은 MapPerson.sameDayPillar 로 따로 나른다.
 */
const FEATURE_OF: Partial<Record<RelationBadge, Feature>> = {
  육합: "yukhap",
  충: "chung",
};

/**
 * 일주를 세운다. 만세력이 못 세우는 값이면 null.
 *
 * 던지는 경우가 여럿이다(실측): 없는 양력 날짜("Invalid solar date"), 없는 월,
 * 없는 윤달("Invalid lunar date ... (leap)"), 그리고 지원 범위 1900~2050 밖.
 * 전부 같이 null 로 접는다 — 사용자가 폼에 친 값이라, 지도 한 명이 계산되지
 * 않는다고 지도 전체가 500 이 되면 안 된다. 호출부가 걸러낸다.
 */
export function dayPillarOf(birth: BirthLite): DayPillarInput | null {
  try {
    const pillars = buildPillars({
      year: birth.year,
      month: birth.month,
      day: birth.day,
      calendar: birth.calendar,
      isLeapMonth: birth.isLeapMonth,
    });
    return { stem: pillars.day.stem, branch: pillars.day.branch };
  } catch {
    return null;
  }
}

/** 지도의 중심. 관계가 없으므로 일주 캐릭터만 담는다. */
export function centerOf(name: string, birth: BirthLite): MapCenter | null {
  const day = dayPillarOf(birth);
  if (!day) return null;
  const character = characterOf(day.stem, day.branch);
  return { name, pillarKey: character.key, sceneName: character.scene.name };
}

/** 중심의 일주를 기준으로 한 사람의 자리를 정한다. */
export function toMapPerson(
  centerDay: DayPillarInput,
  row: MapPersonRow,
): MapPerson | null {
  const day = dayPillarOf(row);
  if (!day) return null;

  const relation = getRelation(centerDay, day);
  const character = characterOf(day.stem, day.branch);
  const badge = relation.badges[0];

  return {
    id: row.id,
    name: row.name,
    pillarKey: character.key,
    sceneName: character.scene.name,
    role: ROLE_OF[relation.kind],
    feature: (badge && FEATURE_OF[badge]) ?? "none",
    sameDayPillar: badge === "동일일주",
  };
}
