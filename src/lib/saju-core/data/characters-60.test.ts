import { describe, expect, it } from "vitest";

import { BRANCH_ORDER, isBranch } from "./branches";
import {
  BRANCH_PRINCIPLES,
  CHARACTER_COPY,
  CHARACTER_KEYS,
  FAMILIES,
  SEATS,
  characterBasis,
  characterSeatGroup,
  type CharacterKey,
} from "./characters-60";
import { STEM_ORDER, isStem } from "./stems";

/** 캐릭터 키를 일간·일지로 쪼갠다 (한글 간지 2글자) */
function split(key: CharacterKey) {
  const [stem, branch] = Array.from(key);
  if (!isStem(stem) || !isBranch(branch)) {
    throw new Error(`잘못된 간지 키: ${key}`);
  }
  return { stem, branch };
}

describe("60갑자 캐릭터 데이터", () => {
  it("CHARACTER_KEYS는 60갑자 순환과 정확히 일치한다", () => {
    const cycle = Array.from({ length: 60 }, (_, i) =>
      `${STEM_ORDER[i % 10]}${BRANCH_ORDER[i % 12]}`.toString(),
    );
    expect(CHARACTER_KEYS).toEqual(cycle);
  });

  it("카피는 60종 전부, 키 누락·중복이 없다", () => {
    const copyKeys = Object.keys(CHARACTER_COPY);
    expect(copyKeys).toHaveLength(60);
    expect(new Set(copyKeys)).toEqual(new Set(CHARACTER_KEYS));
  });

  it("패밀리 10 · 지지 원리 12 · 십성 자리 5가 모두 채워져 있다", () => {
    expect(Object.keys(FAMILIES)).toHaveLength(10);
    expect(Object.keys(BRANCH_PRINCIPLES)).toHaveLength(12);
    expect(Object.keys(SEATS)).toHaveLength(5);
    expect(new Set(Object.values(FAMILIES).map((f) => f.name)).size).toBe(10);
  });
});

describe("카피 규칙", () => {
  const entries = CHARACTER_KEYS.map((key) => [key, CHARACTER_COPY[key]] as const);

  it.each(entries)("%s — 빈 문자열이 없고 칩은 3개다", (_key, copy) => {
    expect(copy.sceneName.trim()).not.toBe("");
    expect(copy.hook.trim()).not.toBe("");
    expect(copy.desc.trim()).not.toBe("");
    expect(copy.shadow.trim()).not.toBe("");
    expect(copy.chips).toHaveLength(3);
    for (const chip of copy.chips) expect(chip.trim()).not.toBe("");
  });

  it.each(entries)("%s — 장면명에 패밀리 단어가 들어간다", (key, copy) => {
    const { stem } = split(key);
    const familyWord = FAMILIES[stem].name.replace("형", "");
    expect(copy.sceneName).toContain(familyWord);
  });

  it.each(entries)("%s — 훅은 '…사람', 약점은 해요체 한 문장이다", (_key, copy) => {
    expect(copy.hook.endsWith("사람")).toBe(true);
    expect(copy.shadow.endsWith("요.")).toBe(true);
  });

  it.each(entries)("%s — 본문은 두 문장이다", (_key, copy) => {
    const sentences = copy.desc.split(/(?<=요\.)\s*/).filter(Boolean);
    expect(sentences).toHaveLength(2);
  });

  it("장면명·훅·본문·약점은 60종 사이에서 겹치지 않는다", () => {
    for (const field of ["sceneName", "hook", "desc", "shadow"] as const) {
      const values = CHARACTER_KEYS.map((k) => CHARACTER_COPY[k][field]);
      expect(new Set(values).size).toBe(60);
    }
  });
});

describe("내부 근거(파생값)", () => {
  it("십성 자리는 일간 대 일지 본기로 판정한다", () => {
    // 갑목이 자(본기 계수) 위 → 수생목 = 인성
    expect(characterSeatGroup("갑", "자")).toBe("인성");
    // 경금이 신(본기 경금) 위 → 동일 오행 = 비겁
    expect(characterSeatGroup("경", "신")).toBe("비겁");
    // 임수가 진(본기 무토) 위 → 토극수 = 관성
    expect(characterSeatGroup("임", "진")).toBe("관성");
  });

  it("근거 문장은 패밀리 라벨·십성·지지 원리로 조립된다", () => {
    expect(characterBasis("갑", "자")).toBe(
      "갑목 일간이 자(인성, 깊은 물·한밤) 위에 앉은 구조",
    );
  });

  it("60종 모두 근거 문장을 만들 수 있다", () => {
    for (const key of CHARACTER_KEYS) {
      const { stem, branch } = split(key);
      expect(characterBasis(stem, branch)).toContain("위에 앉은 구조");
    }
  });
});
