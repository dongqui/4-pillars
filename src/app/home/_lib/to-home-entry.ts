import { characterFromBirth } from "@/lib/saju-core";
import type { Character } from "@/lib/saju-core/character";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 홈 셀렉터의 한 줄. 저장된 프로필과 쿠키에만 있는 익명 캐릭터가 같은 모양으로 선다 —
 * 비로그인도 홈을 볼 수 있어야 랜딩 → 캐릭터 → 홈 흐름이 로그인 벽에서 끊기지 않는다.
 */
export interface HomeEntry {
  key: string;
  name: string;
  /** 아바타에 넣을 이름 첫 글자 */
  initial: string;
  /** 생년월일로 세울 수 없는 프로필이면 null */
  character: Character | null;
  /** 저장된 프로필이 아니면 null */
  profileId: string | null;
}

/** 스프레드로 자르는 이유: 서로게이트 쌍이 반으로 잘리지 않게 (기존 프로필 카드와 같다) */
function initialOf(name: string): string {
  return [...name][0] ?? "?";
}

export function toHomeEntry(row: ProfileRow): HomeEntry {
  return {
    key: row.id,
    name: row.name,
    initial: initialOf(row.name),
    character: characterOfProfile(row),
    profileId: row.id,
  };
}

export function toAnonEntry(character: Character, name: string | null): HomeEntry {
  return {
    key: "anon",
    name: name ?? "나",
    initial: initialOf(name ?? "나"),
    character,
    profileId: null,
  };
}

/**
 * 프로필의 생년월일로 캐릭터를 세운다.
 *
 * 던지지 않는다 — 만세력 지원 범위(1900~2050) 밖의 연도가 프로필로 저장돼 있으면
 * buildPillars 가 예외를 내는데, 그 한 줄 때문에 홈 전체가 500 이 되면 안 된다.
 */
function characterOfProfile(row: ProfileRow): Character | null {
  try {
    return characterFromBirth({
      year: row.birth.year,
      month: row.birth.month,
      day: row.birth.day,
      calendar: row.calendar,
      isLeapMonth: row.isLeapMonth,
    });
  } catch (e) {
    console.error("[home] characterFromBirth", e instanceof Error ? e.message : e);
    return null;
  }
}
