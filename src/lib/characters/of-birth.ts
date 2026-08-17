import { characterFromBirth, type Character } from "@/lib/saju-core";

/**
 * 캐릭터를 세우는 데 실제로 쓰이는 필드. 프로필 행(ProfileRow)과 익명 드래프트
 * (CreateProfileBody)가 이 모양을 공유해서, 두 곳이 같은 함수를 쓴다.
 *
 * 시각·출생지·성별은 없다 — 일주는 날짜만으로 정해진다. 그 셋은 리포트(시주·진태양시·
 * 대운)에서 쓰인다.
 */
export interface BirthFields {
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birth: { year: number; month: number; day: number };
}

/**
 * 던지지 않는다. 만세력이 지원하는 범위(1900~2050) 밖이거나 존재하지 않는 음력
 * 조합이면 null 이다 — 캐릭터 한 장 때문에 홈이나 리빌 전체가 500 이 되면 안 된다.
 */
export function characterOfBirth(fields: BirthFields): Character | null {
  try {
    return characterFromBirth({
      year: fields.birth.year,
      month: fields.birth.month,
      day: fields.birth.day,
      calendar: fields.calendar,
      isLeapMonth: fields.isLeapMonth,
    });
  } catch (e) {
    console.error("[character] characterFromBirth", e instanceof Error ? e.message : e);
    return null;
  }
}
