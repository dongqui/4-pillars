// 일주 → 60캐릭터 매핑
//
// 신규 계산은 없다. chart.ts가 이미 일주를 {stem, branch}로 주므로
// 여기서는 데이터 테이블(characters-60)을 조립해 카드가 쓸 형태로 넘긴다.
//
// 자시(23시~) 정책: 라이트 퍼널은 시간을 받지 않으므로 입력 날짜를 그대로 쓴다.
// 야자시(23시 이후를 다음 날로 볼지)는 시주가 필요한 유료 리포트에서만 다룬다.

import type { Chart } from "./chart";
import { BRANCHES, type Branch } from "./data/branches";
import {
  BRANCH_PRINCIPLES,
  CHARACTER_COPY,
  CHARACTER_KEYS,
  FAMILIES,
  SEATS,
  characterBasis,
  characterSeatGroup,
  type CharacterCopy,
  type CharacterKey,
} from "./data/characters-60";
import type { TenGodGroup } from "./data/relations";
import { STEMS, type Element, type Stem, type YinYang } from "./data/stems";

export interface CharacterFamilyView {
  stem: Stem;
  /** 노출명 (예: "큰나무형") */
  name: string;
  /** 한자 (예: "甲木") */
  hanja: string;
  /** 한글 라벨 (예: "갑목") */
  label: string;
  element: Element;
  yinYang: YinYang;
}

export interface CharacterSceneView {
  /** 장면명 (예: "깊은 물가의 큰나무") */
  name: string;
  branch: Branch;
  /** 일지 원리 (예: "깊은 물·한밤") */
  principle: string;
}

/** 카드에 노출하지 않는 판정 근거 — 리포트·검수용 */
export interface CharacterInternal {
  tenGodGroup: TenGodGroup;
  seatMeaning: string;
  keywords: string;
  basis: string;
}

export interface Character {
  /** 60갑자 순번 (갑자=0 … 계해=59) */
  id: number;
  /** 한글 간지 키 (예: "갑자") */
  key: CharacterKey;
  /** 한자 간지 (예: "甲子") */
  hanja: string;
  /** 일간 */
  stem: Stem;
  /** 일지 */
  branch: Branch;
  family: CharacterFamilyView;
  scene: CharacterSceneView;
  copy: Omit<CharacterCopy, "sceneName">;
  internal: CharacterInternal;
}

function keyOf(stem: Stem, branch: Branch): CharacterKey {
  const key = `${stem}${branch}`;
  const id = CHARACTER_KEYS.indexOf(key as CharacterKey);
  if (id < 0) {
    throw new Error(`60갑자에 없는 조합: ${key} (천간·지지의 음양이 어긋남)`);
  }
  return key as CharacterKey;
}

/** 일간·일지로 캐릭터를 조립한다 */
export function characterOf(stem: Stem, branch: Branch): Character {
  const key = keyOf(stem, branch);
  const { sceneName, ...copy } = CHARACTER_COPY[key];
  const family = FAMILIES[stem];
  const stemInfo = STEMS[stem];
  const tenGodGroup = characterSeatGroup(stem, branch);
  const seat = SEATS[tenGodGroup];

  return {
    id: CHARACTER_KEYS.indexOf(key),
    key,
    hanja: `${stemInfo.hanja}${BRANCHES[branch].hanja}`,
    stem,
    branch,
    family: {
      stem,
      name: family.name,
      hanja: family.hanja,
      label: family.label,
      element: stemInfo.element,
      yinYang: stemInfo.yinYang,
    },
    scene: {
      name: sceneName,
      branch,
      principle: BRANCH_PRINCIPLES[branch],
    },
    copy,
    internal: {
      tenGodGroup,
      seatMeaning: seat.seatMeaning,
      keywords: seat.keywords,
      basis: characterBasis(stem, branch),
    },
  };
}

/** 60갑자 순번으로 캐릭터를 얻는다 — 공유 링크·갤러리용 */
export function characterById(id: number): Character {
  const key = Number.isInteger(id) ? CHARACTER_KEYS[id] : undefined;
  if (key === undefined) {
    throw new Error(`캐릭터 id는 0~59의 정수여야 한다: ${id}`);
  }
  const [stem, branch] = Array.from(key) as [Stem, Branch];
  return characterOf(stem, branch);
}

/** 원국의 일주로 캐릭터를 판정한다 — 시주(hour) 없이도 동작한다 */
export function characterFromChart(chart: Chart): Character {
  return characterOf(chart.day.stem, chart.day.branch);
}

/** 60종 전체 — 순번 순서 */
export const ALL_CHARACTERS: readonly Character[] = CHARACTER_KEYS.map((_, id) =>
  characterById(id),
);
