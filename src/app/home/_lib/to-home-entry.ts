import { characterOfBirth } from "@/lib/characters/of-birth";
import type { Character } from "@/lib/saju-core/character";
import type { CreateProfileBody } from "@/lib/profiles/input";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 홈 셀렉터의 한 줄. 저장된 프로필과 아직 계정이 없는 익명 드래프트가 같은 모양으로 선다 —
 * 비로그인도 홈을 볼 수 있어야 랜딩 → 퍼널 → 리빌 → 홈 흐름이 로그인 벽에서 끊기지 않는다.
 */
export interface HomeEntry {
  key: string;
  name: string;
  /** 아바타에 넣을 이름 첫 글자 */
  initial: string;
  /** 생년월일로 세울 수 없으면 null */
  character: Character | null;
  /** 아직 계정에 저장되지 않았으면 null */
  profileId: string | null;
}

/** 스프레드로 자르는 이유: 서로게이트 쌍이 반으로 잘리지 않게 */
function initialOf(name: string): string {
  return [...name][0] ?? "?";
}

export function toHomeEntry(row: ProfileRow): HomeEntry {
  return {
    key: row.id,
    name: row.name,
    initial: initialOf(row.name),
    character: characterOfBirth(row),
    profileId: row.id,
  };
}

/** 로그인 전 입력. 로그인하는 순간 프로필로 승격되고 이 줄은 사라진다 */
export function toDraftEntry(draft: CreateProfileBody): HomeEntry {
  return {
    key: "draft",
    name: draft.name,
    initial: initialOf(draft.name),
    character: characterOfBirth(draft),
    profileId: null,
  };
}
