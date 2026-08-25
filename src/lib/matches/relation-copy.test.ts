import { describe, expect, it } from "vitest";
import { RELATION_TYPE_IDS, type RelationInput } from "./relation-types";
import {
  RELATION_COPY,
  VARIANT_SECTION_KEYS,
  relationAngleBlocks,
  relationCopy,
} from "./relation-copy";

const rel = (type: RelationInput["type"]): RelationInput => ({
  type,
  subjectRole: null,
  counterpartRole: null,
});

describe("RELATION_COPY", () => {
  // 타입은 칸이 있는지만 잡는다. 빈 문자열은 컴파일을 통과하고 화면에서 제목이 사라진다.
  it("모든 유형 × 모든 섹션이 실제로 채워져 있다", () => {
    for (const type of RELATION_TYPE_IDS) {
      for (const key of VARIANT_SECTION_KEYS) {
        const copy = RELATION_COPY[type][key];
        expect(copy.category.trim().length, `${type}.${key}.category`).toBeGreaterThan(0);
        expect(copy.title.trim().length, `${type}.${key}.title`).toBeGreaterThan(0);
        expect(copy.angles.length, `${type}.${key}.angles`).toBeGreaterThan(0);
        for (const angle of copy.angles) {
          expect(angle.trim().length, `${type}.${key} 의 빈 관점`).toBeGreaterThan(0);
        }
      }
    }
  });

  // 06 과 07 은 화면에서 나란히 붙는다. 라벨이 같으면 읽는 사람이 두 섹션을 가릴 수 없다.
  it("한 유형 안에서 06 과 07 의 라벨이 겹치지 않는다", () => {
    for (const type of RELATION_TYPE_IDS) {
      expect(RELATION_COPY[type].presence.category, type).not.toBe(
        RELATION_COPY[type].continuity.category,
      );
    }
  });

  // relationCopy 를 거쳐 읽는다. RELATION_COPY 는 `as const satisfies` 라 각 칸이
  // RelationCopy 가 아니라 자기 리터럴 타입이고, caution 이 없는 칸에서 `.caution` 을
  // 직접 읽으면 "그런 속성 없음" 으로 컴파일이 깨진다.
  it("금지선은 있는 자리에만 있다 — 기획안이 네 자리에서만 요구한다", () => {
    expect(relationCopy(rel("spouse"), "continuity").caution).toBeDefined();
    expect(relationCopy(rel("business"), "continuity").caution).toBeDefined();
    expect(relationCopy(rel("lover"), "presence").caution).toBeUndefined();
  });
});

describe("relationCopy", () => {
  it("유형이 없으면 기타(custom) 카피로 물러선다 — 건너뛰기가 막다른 길이 되면 안 된다", () => {
    expect(relationCopy(rel(null), "closeness")).toBe(RELATION_COPY.custom.closeness);
  });

  it("유형마다 다른 카피를 낸다", () => {
    expect(relationCopy(rel("spouse"), "closeness").category).toBe("마음이 가까워지는 순간");
    expect(relationCopy(rel("work"), "closeness").category).toBe("신뢰가 쌓이는 방식");
  });
});

describe("relationAngleBlocks", () => {
  it("빈 목록이면 아무것도 붙이지 않는다", () => {
    expect(relationAngleBlocks(rel("lover"), [])).toEqual([]);
  });

  it("요청한 섹션마다 블록을 하나씩 낸다", () => {
    const text = relationAngleBlocks(rel("lover"), ["presence", "continuity"]).join("\n");
    expect(text).toContain(`[이 관계에서 볼 장면 · ${RELATION_COPY.lover.presence.category}]`);
    expect(text).toContain(`[이 관계에서 볼 장면 · ${RELATION_COPY.lover.continuity.category}]`);
    expect(text).toContain("- 애정 표현");
  });

  it("금지선이 있으면 블록 끝에 붙는다", () => {
    const text = relationAngleBlocks(rel("business"), ["continuity"]).join("\n");
    expect(text).toContain("제한: ");
    expect(text).toContain("사업 성공");
  });
});
