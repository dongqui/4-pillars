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
  const content = z.toJSONSchema(spec(key).schema, { io: "output" }) as Record<string, unknown>;
  // $schema 는 최상위 문서에나 의미가 있다. properties.content 밑에 얹혀 있어봤자
  // 아무도 안 읽는 죽은 값이라 지운다.
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/**
 * 세운·대운은 LLM 서술을 계산된 기간과 인덱스로 짝짓는다. 개수가 어긋나면
 * 조립 단계에서 통째로 버려지므로, 요청할 때만 개수를 못박아 넘긴다.
 *
 * luck 저장소인 이 둘 말고는 손대면 안 된다 — strengths 등 다른 배열 섹션까지
 * "최상위가 배열이면" 식으로 건드리면 그 섹션 고유의 min/max 를 덮어써버린다.
 * 그래서 스키마 모양이 아니라 키로 직접 분기한다.
 *
 * 저장·조회 검증에는 쓰지 않는다 — getCached 는 chartKey 밖 입력인 rows 를 모른다.
 */
export function llmInputSchemaWithRows(
  key: SectionKey,
  rows: number,
): Record<string, unknown> {
  const schema = llmInputSchema(key);
  const content = (schema.properties as { content: Record<string, unknown> }).content;
  const target: Record<string, unknown> | undefined =
    key === "yearlyLuck"
      ? content
      : key === "daeunOutlook"
        ? (content.properties as Record<string, Record<string, unknown>>).rows
        : undefined;
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

/**
 * `target[key] = value` 를 대신한다. key 가 (제네릭이 아니라) 이미 좁혀진
 * SectionKey 공용체인 상태로 인덱스 대입을 하면, TS 가 각 케이스를 값과
 * 상관관계로 엮지 못해 "union 은 intersection 에 대입 불가" 오류를 낸다
 * (microsoft/TypeScript#30581). 호출부에서 K 를 제네릭으로 다시 잡아주면
 * 그 인스턴스에서는 key 와 value 가 짝지어져 타입 체크를 통과한다 —
 * 런타임 동작은 직접 대입과 동일하다. 나중에 "그냥 대입으로 바꿔도 되지
 * 않나" 하고 단순화하지 말 것.
 */
export function assign<T, K extends keyof T>(target: Partial<T>, key: K, value: T[K]): void {
  target[key] = value;
}
