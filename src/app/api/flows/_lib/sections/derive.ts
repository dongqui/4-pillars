import { z } from "zod";
import {
  FLOW_SECTIONS,
  type ClosingContent,
  type FlowSchemaContext,
  type FlowSectionSpec,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type PivotsContent,
  type ProseContent,
} from "./registry";

export type FlowSectionKey = keyof typeof FLOW_SECTIONS;

/**
 * 섹션별 content 타입.
 *
 * schema 가 팩토리라 z.infer 로 뽑으면 컨텍스트에 따라 타입이 흔들린다. 모양은
 * 여섯 가지뿐이라 여기서 명시적으로 짝지어 준다 — 읽는 쪽이 훨씬 분명하다.
 */
export type FlowInterpretation = {
  overview: OverviewContent;
  rising: ItemsContent;
  straining: ItemsContent;
  work: ProseContent;
  relating: ProseContent;
  money: ProseContent;
  months: MonthsContent;
  pivots: PivotsContent;
  closing: ClosingContent;
};

export const FLOW_SECTION_KEYS = Object.keys(FLOW_SECTIONS) as FlowSectionKey[];

const spec = (key: FlowSectionKey): FlowSectionSpec => FLOW_SECTIONS[key] as FlowSectionSpec;

/** DB 에서 읽은 section_key 를 좁힌다 (모르는 키 = 지워진 섹션). */
export function isFlowSectionKey(v: unknown): v is FlowSectionKey {
  return typeof v === "string" && Object.hasOwn(FLOW_SECTIONS, v);
}

export function flowSectionVersion(key: FlowSectionKey): number {
  return spec(key).version;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션이 있을 수 있어
 * 전부 { content: ... } 한 겹으로 감싼다 — 리포트·궁합과 같은 계약이다.
 *
 * 컨텍스트를 받는 것이 리포트·궁합과 다른 점이다. 08 의 정의역이 스키마 안에
 * 박히므로 LLM 이 계산되지 않은 달을 변곡점이라고 우길 수 없다.
 */
export function flowLlmInputSchema(
  key: FlowSectionKey,
  ctx: FlowSchemaContext,
): Record<string, unknown> {
  const content = z.toJSONSchema(spec(key).schema(ctx)) as Record<string, unknown>;
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/** 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션" 으로 다룬다. */
export function parseFlowSectionContent<K extends FlowSectionKey>(
  key: K,
  raw: unknown,
  ctx: FlowSchemaContext,
): FlowInterpretation[K] | null {
  const result = spec(key).schema(ctx).safeParse(raw);
  return result.success ? (result.data as FlowInterpretation[K]) : null;
}

/**
 * `target[key] = value` 를 대신한다. 이유는 saju sections/derive.ts 의 assign 과 같다
 * (microsoft/TypeScript#30581). 단순 대입으로 바꾸지 말 것.
 */
export function assignFlow<T, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K],
): void {
  target[key] = value;
}
