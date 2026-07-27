import { z } from "zod";
import { SECTIONS, type SectionSpec, type SectionStorage } from "./registry";

export type SectionKey = keyof typeof SECTIONS;

/** 섹션 하나의 content 타입. registry 의 zod 스키마에서 바로 나온다. */
export type SectionContent<K extends SectionKey> = z.infer<(typeof SECTIONS)[K]["schema"]>;

/** 전 섹션이 다 있는 완전한 해석. 실제로는 대부분 Partial 로 다룬다. */
export type Interpretation = { [K in SectionKey]: SectionContent<K> };

export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

const spec = (key: SectionKey): SectionSpec => SECTIONS[key] as SectionSpec;

const keysWhere = (p: (s: SectionSpec) => boolean): SectionKey[] =>
  SECTION_KEYS.filter((k) => p(spec(k)));

export const FREE_SECTION_KEYS = keysWhere((s) => s.tier === "free");
export const PAID_SECTION_KEYS = keysWhere((s) => s.tier === "paid");
export const CHART_SECTION_KEYS = keysWhere((s) => s.storage === "chart");
export const LUCK_SECTION_KEYS = keysWhere((s) => s.storage === "luck");

/** DB에서 읽은 section_key 문자열을 좁힌다 (모르는 키 = 지워진 섹션). */
export function isSectionKey(v: unknown): v is SectionKey {
  return typeof v === "string" && Object.hasOwn(SECTIONS, v);
}

export function sectionVersion(key: SectionKey): number {
  return spec(key).version;
}

export function sectionStorage(key: SectionKey): SectionStorage {
  return spec(key).storage;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션이 있어서
 * 전부 { content: ... } 한 겹으로 감싼다. 응답에서 .content 를 벗겨 검증한다.
 */
export function llmInputSchema(key: SectionKey): Record<string, unknown> {
  return {
    type: "object",
    properties: { content: z.toJSONSchema(spec(key).schema, { io: "output" }) },
    required: ["content"],
    additionalProperties: false,
  };
}

/**
 * 세운·대운은 LLM 서술을 계산된 기간과 인덱스로 짝짓는다. 개수가 어긋나면
 * 조립 단계에서 통째로 버려지므로, 요청할 때만 개수를 못박아 넘긴다.
 *
 * 저장·조회 검증에는 쓰지 않는다 — getCached 는 chartKey 밖 입력인 rows 를 모른다.
 */
export function llmInputSchemaWithRows(
  key: SectionKey,
  rows: number,
): Record<string, unknown> {
  const schema = llmInputSchema(key);
  const content = (schema.properties as { content: Record<string, unknown> }).content;
  // 배열 섹션(yearlyLuck)은 content 자신이, 객체 섹션(daeunOutlook)은 rows 가 대상이다.
  const target =
    content.type === "array"
      ? content
      : (content.properties as Record<string, Record<string, unknown>> | undefined)?.rows;
  if (target) {
    target.minItems = rows;
    target.maxItems = rows;
  }
  return schema;
}

/** 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션"으로 다룬다. */
export function parseSectionContent<K extends SectionKey>(
  key: K,
  raw: unknown,
): SectionContent<K> | null {
  const result = spec(key).schema.safeParse(raw);
  return result.success ? (result.data as SectionContent<K>) : null;
}
