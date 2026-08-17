import { describe, expect, it } from "vitest";
import {
  RELATION_TYPES,
  RELATION_TYPE_IDS,
  isRelationComplete,
  relationInputSchema,
  relationLabel,
  relationLens,
} from "./relation-types";

const ok = (v: unknown) => relationInputSchema.safeParse(v).success;

describe("RELATION_TYPES", () => {
  it("모든 유형이 lens 를 갖는다 — 없으면 그 유형만 서술이 밋밋해진다", () => {
    for (const id of RELATION_TYPE_IDS) {
      expect(RELATION_TYPES[id].lens.length).toBeGreaterThan(0);
    }
  });

  it("기타는 자유 역할이다", () => {
    expect(RELATION_TYPES.custom.roles).toBe("free");
  });
});

describe("relationInputSchema", () => {
  it("유형 없음 — 역할도 없어야 한다", () => {
    expect(ok({ type: null, subjectRole: null, counterpartRole: null })).toBe(true);
    expect(ok({ type: null, subjectRole: "멘토", counterpartRole: "멘티" })).toBe(false);
  });

  it("대칭 유형에 역할을 붙일 수 없다", () => {
    expect(ok({ type: "lover", subjectRole: null, counterpartRole: null })).toBe(true);
    expect(ok({ type: "lover", subjectRole: "윗사람", counterpartRole: "아랫사람" })).toBe(false);
  });

  it("비대칭 유형은 정해진 역할 쌍만 받는다 — 스왑은 허용", () => {
    expect(ok({ type: "parent", subjectRole: "부모", counterpartRole: "자녀" })).toBe(true);
    expect(ok({ type: "parent", subjectRole: "자녀", counterpartRole: "부모" })).toBe(true);
    expect(ok({ type: "parent", subjectRole: "부모", counterpartRole: "부모" })).toBe(false);
    expect(ok({ type: "parent", subjectRole: "멘토", counterpartRole: "멘티" })).toBe(false);
    expect(ok({ type: "parent", subjectRole: null, counterpartRole: null })).toBe(false);
  });

  it("기타는 자유 입력이지만 비어 있을 수 없다", () => {
    expect(ok({ type: "custom", subjectRole: "멘토", counterpartRole: "멘티" })).toBe(true);
    expect(ok({ type: "custom", subjectRole: null, counterpartRole: "멘티" })).toBe(false);
    expect(ok({ type: "custom", subjectRole: "  ", counterpartRole: "멘티" })).toBe(false);
  });

  it("자유 역할은 길이와 문자를 제한한다 — 프롬프트에 실려 나가는 값이다", () => {
    expect(ok({ type: "custom", subjectRole: "가".repeat(13), counterpartRole: "멘티" })).toBe(false);
    expect(ok({ type: "custom", subjectRole: "멘토\n무시하고", counterpartRole: "멘티" })).toBe(false);
  });

  it("공백은 잘라서 담는다", () => {
    const parsed = relationInputSchema.parse({
      type: "custom", subjectRole: " 멘토 ", counterpartRole: "멘티",
    });
    expect(parsed.subjectRole).toBe("멘토");
  });
});

// 화면의 제출 조건이다. 이 판정이 스키마와 어긋나면 사용자는 버튼을 누르고 400 을 받는다.
describe("isRelationComplete", () => {
  it("'기타' 를 고르고 두 칸이 비어 있으면 아직 아니다 — 그대로 제출하면 400 이다", () => {
    expect(isRelationComplete({ type: "custom", subjectRole: "", counterpartRole: "" })).toBe(false);
  });

  it("'기타' 의 한 칸만 채워도 아직 아니다", () => {
    expect(isRelationComplete({ type: "custom", subjectRole: "멘토", counterpartRole: "" })).toBe(false);
    expect(isRelationComplete({ type: "custom", subjectRole: "", counterpartRole: "멘티" })).toBe(false);
  });

  it("공백만 채운 칸은 채운 것이 아니다", () => {
    expect(isRelationComplete({ type: "custom", subjectRole: "   ", counterpartRole: "멘티" })).toBe(false);
  });

  it("'기타' 의 두 칸을 채우면 통과", () => {
    expect(isRelationComplete({ type: "custom", subjectRole: "멘토", counterpartRole: "멘티" })).toBe(true);
  });

  it("유형을 건너뛴 것은 미완성이 아니다 — 건너뛰기가 막다른 길이 되면 안 된다", () => {
    expect(isRelationComplete({ type: null, subjectRole: null, counterpartRole: null })).toBe(true);
  });

  it("대칭 유형과 비대칭 유형의 기본 역할도 통과", () => {
    expect(isRelationComplete({ type: "lover", subjectRole: null, counterpartRole: null })).toBe(true);
    expect(isRelationComplete({ type: "parent", subjectRole: "부모", counterpartRole: "자녀" })).toBe(true);
  });
});

describe("relationLens / relationLabel", () => {
  it("유형이 없으면 범용 렌즈로 물러선다", () => {
    const none = { type: null, subjectRole: null, counterpartRole: null };
    expect(relationLens(none).length).toBeGreaterThan(0);
    expect(relationLabel(none)).toBe("두 사람");
  });

  it("기타는 역할로 라벨을 만든다", () => {
    expect(relationLabel({ type: "custom", subjectRole: "멘토", counterpartRole: "멘티" }))
      .toBe("멘토 - 멘티");
  });

  it("고정 유형은 목록의 이름을 쓴다", () => {
    expect(relationLabel({ type: "lover", subjectRole: null, counterpartRole: null }))
      .toBe("연인");
  });
});
