// 관계 유형 — 목록을 늘리는 유일한 자리.
//
// DB 에 CHECK 제약을 걸지 않는다. 유형 추가는 카피 수준의 변경인데 CHECK 를 걸면
// 매번 마이그레이션이 필요해진다. 못 어기게 막는 일은 아래 zod 스키마가 하고,
// RelationTypeId 유니온이 화면·프롬프트·API 셋을 동시에 강제한다.

import { z } from "zod";

export interface RelationTypeSpec {
  label: string;
  /**
   * null  = 대칭 유형 (역할 없음)
   * [a,b] = 비대칭 유형 (스왑 가능)
   * "free"= 사용자가 직접 쓰는 역할
   */
  roles: readonly [string, string] | null | "free";
  /** 프롬프트에 주입되는 유형별 시선 한 문장 */
  lens: string;
}

export const RELATION_TYPES = {
  crush: {
    label: "썸",
    roles: null,
    lens: "아직 관계가 정해지지 않은 사이다. 확신보다 신호를 읽는 국면에 초점을 둔다.",
  },
  lover: {
    label: "연인",
    roles: null,
    lens: "서로를 선택한 사이다. 마음의 속도 차이와 표현 방식의 어긋남에 초점을 둔다.",
  },
  spouse: {
    label: "배우자",
    roles: null,
    lens: "오래 함께 사는 사이다. 설렘보다 생활의 리듬과 결정 방식에 초점을 둔다.",
  },
  parent: {
    label: "부모-자녀",
    roles: ["부모", "자녀"],
    lens: "돌봄과 독립이 부딪히는 사이다. 기대와 부담이 오가는 방향에 초점을 둔다.",
  },
  sibling: {
    label: "형제/자매",
    roles: null,
    lens: "같은 뿌리에서 자란 사이다. 비교와 편들기가 오가는 방식에 초점을 둔다.",
  },
  friend: {
    label: "친구",
    roles: null,
    lens: "의무 없이 이어지는 사이다. 편안함이 유지되는 조건과 멀어지는 계기에 초점을 둔다.",
  },
  work: {
    label: "직장 상하",
    roles: ["윗사람", "아랫사람"],
    lens: "권한이 한쪽에 있는 사이다. 지시와 보고가 오가는 방식에 초점을 둔다.",
  },
  business: {
    label: "사업 파트너",
    roles: null,
    lens: "이익과 책임을 나누는 사이다. 위험 감수의 온도차와 역할 분담에 초점을 둔다.",
  },
  teacher: {
    label: "선생-제자",
    roles: ["선생", "제자"],
    lens: "가르치고 배우는 사이다. 전달되는 것과 전달되지 않는 것에 초점을 둔다.",
  },
  custom: {
    label: "기타",
    roles: "free",
    lens: "두 사람이 스스로 붙인 역할로 만나는 사이다. 그 역할이 실제로 작동하는지에 초점을 둔다.",
  },
} as const satisfies Record<string, RelationTypeSpec>;

export type RelationTypeId = keyof typeof RELATION_TYPES;

export const RELATION_TYPE_IDS = Object.keys(RELATION_TYPES) as RelationTypeId[];

export interface RelationInput {
  type: RelationTypeId | null;
  subjectRole: string | null;
  counterpartRole: string | null;
}

export const ROLE_MAX_LENGTH = 12;

/**
 * 자유 역할 문자열. 이 값은 LLM 프롬프트에 실려 나가므로 입력이 아니라 **경계**다.
 * 제어문자(개행 포함)를 막는 이유: 여러 줄이 들어오면 프롬프트의 블록 구조를
 * 흉내 내 지시문처럼 읽히게 만들 수 있다.
 */
const roleText = z
  .string()
  .trim()
  .min(1)
  .max(ROLE_MAX_LENGTH)
  .regex(/^[^\p{C}]+$/u, "역할에 줄바꿈이나 제어문자를 넣을 수 없습니다");

const rawRelation = z.object({
  type: z.enum(RELATION_TYPE_IDS).nullable(),
  subjectRole: roleText.nullable(),
  counterpartRole: roleText.nullable(),
});

/**
 * 유형과 역할의 짝이 맞는지까지 스키마가 본다. 이걸 핸들러의 if 문으로 흩어 두면
 * 다음에 유형을 추가할 때 한쪽만 고쳐진다.
 */
export const relationInputSchema = rawRelation.superRefine((v, ctx) => {
  const fail = (message: string) =>
    ctx.addIssue({ code: "custom", message, path: ["subjectRole"] });

  const both = v.subjectRole !== null && v.counterpartRole !== null;
  const neither = v.subjectRole === null && v.counterpartRole === null;

  if (v.type === null) {
    if (!neither) fail("관계 유형 없이 역할만 정할 수 없습니다");
    return;
  }

  const roles = RELATION_TYPES[v.type].roles;

  if (roles === null) {
    if (!neither) fail("이 관계 유형에는 역할이 없습니다");
    return;
  }

  if (roles === "free") {
    if (!both) fail("두 사람의 역할을 모두 적어 주세요");
    return;
  }

  if (!both) {
    fail("이 관계 유형은 누가 어느 쪽인지 정해야 합니다");
    return;
  }
  const [a, b] = roles;
  const forward = v.subjectRole === a && v.counterpartRole === b;
  const swapped = v.subjectRole === b && v.counterpartRole === a;
  if (!forward && !swapped) fail("이 관계 유형에 없는 역할입니다");
}) as z.ZodType<RelationInput>;

/** 유형이 없으면 범용 시선으로 물러선다 — 건너뛰기가 막다른 길이 되면 안 된다. */
export function relationLens(input: RelationInput): string {
  if (input.type === null) {
    return "관계의 종류는 정해지지 않았다. 두 사람의 기운이 섞이는 방식 자체에 초점을 둔다.";
  }
  return RELATION_TYPES[input.type].lens;
}

/** 화면과 프롬프트 헤더가 같이 쓰는 표시 이름. */
export function relationLabel(input: RelationInput): string {
  if (input.type === null) return "두 사람";
  if (input.type === "custom" && input.subjectRole && input.counterpartRole) {
    return `${input.subjectRole} - ${input.counterpartRole}`;
  }
  return RELATION_TYPES[input.type].label;
}
