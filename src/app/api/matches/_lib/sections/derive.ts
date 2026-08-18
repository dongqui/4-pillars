import { z } from "zod";
import { MATCH_SECTIONS, type MatchSectionSpec } from "./registry";

export type MatchSectionKey = keyof typeof MATCH_SECTIONS;

export type MatchSectionContent<K extends MatchSectionKey> = z.infer<
  (typeof MATCH_SECTIONS)[K]["schema"]
>;

export type MatchInterpretation = {
  [K in MatchSectionKey]: MatchSectionContent<K>;
};

export const MATCH_SECTION_KEYS = Object.keys(MATCH_SECTIONS) as MatchSectionKey[];

const spec = (key: MatchSectionKey): MatchSectionSpec => MATCH_SECTIONS[key] as MatchSectionSpec;

/** DB 에서 읽은 section_key 를 좁힌다 (모르는 키 = 지워진 섹션). */
export function isMatchSectionKey(v: unknown): v is MatchSectionKey {
  return typeof v === "string" && Object.hasOwn(MATCH_SECTIONS, v);
}

export function matchSectionVersion(key: MatchSectionKey): number {
  return spec(key).version;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션(moments)이 있어서
 * 전부 { content: ... } 한 겹으로 감싼다 — 리포트와 같은 계약이다.
 */
export function matchLlmInputSchema(key: MatchSectionKey): Record<string, unknown> {
  const content = z.toJSONSchema(spec(key).schema, { io: "output" }) as Record<string, unknown>;
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/** 검증 통과하면 content, 아니면 null. */
export function parseMatchSectionContent<K extends MatchSectionKey>(
  key: K,
  raw: unknown,
): MatchSectionContent<K> | null {
  const result = spec(key).schema.safeParse(raw);
  return result.success ? (result.data as MatchSectionContent<K>) : null;
}

/**
 * `target[key] = value` 를 대신한다. 이유는 saju sections/derive.ts:assign 과 같다
 * (microsoft/TypeScript#30581). 단순 대입으로 바꾸지 말 것.
 */
export function assignMatch<T, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K],
): void {
  target[key] = value;
}
