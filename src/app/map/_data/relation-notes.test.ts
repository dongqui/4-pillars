import { describe, expect, it } from "vitest";
import {
  ELEMENTS,
  controlledBy,
  elementControls,
  elementGenerates,
  generatedBy,
  type Element,
} from "@/lib/saju-core";
import { ROLE_ORDER, type Feature, type RelationRole } from "./roles";
import { ELEMENT_BRIDGE, NATURE_WORDS, NICKNAME_NOTE, relationNote } from "./relation-notes";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

/**
 * 내 일간 오행 × 구역 → 상대 구역의 일간 오행. 관계 엔진(relationship.ts 의
 * relationKind)과 같은 생극 규칙을 saju-core 헬퍼로 다시 세운다 — 25칸의
 * 문장이 엔진과 어긋난 채 배포될 수 없게 하는 것이 이 테스트의 존재 이유다.
 */
function otherElement(my: Element, role: RelationRole): Element {
  switch (role) {
    case "fill": return generatedBy(my);      // 생아: 상대가 나를 생
    case "beside": return my;                  // 비아: 같은 오행
    case "express": return elementGenerates(my); // 아생: 내가 상대를 생
    case "move": return elementControls(my);   // 아극: 내가 상대를 극
    case "refine": return controlledBy(my);    // 극아: 상대가 나를 극
  }
}

describe("ELEMENT_BRIDGE", () => {
  it("25칸이 전부 채워져 있다", () => {
    for (const el of ELEMENTS) {
      for (const role of ROLE_ORDER) {
        expect(ELEMENT_BRIDGE[el][role], `${el}/${role}`).toBeTruthy();
      }
    }
  });

  it("각 칸이 내 오행과 상대 오행을 자연어로 직접 부른다", () => {
    for (const el of ELEMENTS) {
      for (const role of ROLE_ORDER) {
        const sentence = ELEMENT_BRIDGE[el][role];
        expect(sentence, `${el}/${role} 에 내 오행(${NATURE_WORDS[el]})이 없다`)
          .toContain(NATURE_WORDS[el]);
        expect(sentence, `${el}/${role} 에 상대 오행(${NATURE_WORDS[otherElement(el, role)]})이 없다`)
          .toContain(NATURE_WORDS[otherElement(el, role)]);
      }
    }
  });
});

describe("NICKNAME_NOTE", () => {
  it("15칸이 전부 채워져 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(NICKNAME_NOTE[role][feature], `${role}/${feature}`).toBeTruthy();
      }
    }
  });

  // 기존 FEATURE_NOTE 의 ±3자 규칙(roles.test.ts)의 단락판. 한쪽 계열만 길거나
  // 짧으면 그 순간 좋은 관계 / 나쁜 관계가 된다.
  it("六合 과 沖 의 무게 — 각 구역에서 짧은 쪽이 긴 쪽의 70% 이상이다", () => {
    for (const role of ROLE_ORDER) {
      const a = NICKNAME_NOTE[role].yukhap.length;
      const b = NICKNAME_NOTE[role].chung.length;
      expect(Math.min(a, b) / Math.max(a, b), `${role}: yukhap ${a}자 vs chung ${b}자`)
        .toBeGreaterThanOrEqual(0.7);
    }
  });

  it("15개가 서로 다르다", () => {
    const all = ROLE_ORDER.flatMap((r) => FEATURES.map((f) => NICKNAME_NOTE[r][f]));
    expect(new Set(all).size).toBe(15);
  });
});

describe("relationNote", () => {
  it("다리 문장과 별명 단락을 공백 하나로 잇는다", () => {
    expect(relationNote("목", "fill", "chung")).toBe(
      `${ELEMENT_BRIDGE.목.fill} ${NICKNAME_NOTE.fill.chung}`,
    );
  });
});
