import { z } from "zod";

/**
 * 축이 고정된 섹션(선택과 결정 · 일하는 방식)의 축 정의.
 *
 * 라벨 문자열은 여기에만 있다 — 레지스트리의 프롬프트 지시문도, 화면의 행 라벨도
 * 이 맵에서 읽는다. 프롬프트와 화면이 각자 문자열을 들고 있으면 둘이 갈라진다.
 *
 * 축을 고정하는 이유: 사람마다 축이 달라지면 "다른 사람과 비교되는 골격" 이라는
 * 이 섹션의 강점이 사라진다.
 */
export const DECISION_AXES = {
  deciding: "결정을 내릴 때",
  starting: "새로운 일을 시작할 때",
  unsure: "확신이 없을 때",
  afterDeciding: "이미 결정한 뒤에는",
} as const;

export const WORK_AXES = {
  starting: "일을 시작할 때",
  progressing: "일을 풀어가는 방식",
  collaborating: "함께 일할 때",
  troubled: "일이 꼬였을 때",
  performing: "성과를 낼 때",
} as const;

export type AxisMap = Record<string, string>;

/**
 * 축 맵 → 모든 축이 정확히 한 번씩 있는 문자열 객체 스키마.
 *
 * 배열 + z.enum(라벨) 로 두면 LLM 이 같은 축을 두 번 쓰거나 하나를 빠뜨려도
 * 스키마를 통과한다. 객체는 통과하지 못한다.
 *
 * ⚠️ 반환 타입을 z.ZodType 으로 넓혀 적지 마라. SectionContent 가
 * z.infer<SECTIONS[K]["schema"]> 로 나오므로, 넓히는 순간 화면이 받는 타입이
 * unknown 이 되어 필드를 못 읽는다. 추론에 맡겨 축 키를 살려 둔다.
 */
export function axisSchema<T extends AxisMap>(axes: T) {
  const shape = Object.fromEntries(
    Object.keys(axes).map((k) => [k, z.string().min(1)]),
  ) as { [K in keyof T]: z.ZodString };
  return z.object(shape).strict();
}

/** 축 맵 + 내용 → 화면이 그리는 행. 선언 순서를 지킨다. */
export function axisRows<T extends AxisMap>(
  axes: T,
  content: Record<keyof T, string>,
): { label: string; body: string }[] {
  return Object.entries(axes).map(([key, label]) => ({
    label,
    body: content[key as keyof T],
  }));
}

/**
 * 축별 지시문 줄. 키를 함께 적는 이유: LLM 이 채워야 하는 것은 라벨이 아니라
 * 스키마의 필드명이라, 둘을 나란히 보여줘야 어느 칸에 무엇을 쓸지 헷갈리지 않는다.
 */
export function axisPromptLines<T extends AxisMap>(
  axes: T,
  hints: Record<keyof T, string>,
): string[] {
  return Object.entries(axes).map(
    ([key, label]) => `- ${key}(${label}): ${hints[key as keyof T]}`,
  );
}
