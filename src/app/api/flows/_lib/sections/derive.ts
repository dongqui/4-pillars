import { z } from "zod";
import {
  FLOW_SECTIONS,
  type ClosingContent,
  type FlowSectionSpec,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type ProseContent,
} from "./registry";

export type FlowSectionKey = keyof typeof FLOW_SECTIONS;

/**
 * 섹션별 content 타입. 모양은 다섯 가지뿐이라 z.infer 대신 여기서 명시적으로
 * 짝지어 준다 — 읽는 쪽이 훨씬 분명하다.
 */
export type FlowInterpretation = {
  overview: OverviewContent;
  rising: ItemsContent;
  straining: ItemsContent;
  work: ProseContent;
  relating: ProseContent;
  money: ProseContent;
  months: MonthsContent;
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
 */
export function flowLlmInputSchema(key: FlowSectionKey): Record<string, unknown> {
  const content = z.toJSONSchema(spec(key).schema) as Record<string, unknown>;
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/**
 * 검증 실패를 한 줄로 요약한다. 어디가(path) 어떻게 틀렸는지(message)만 남긴다 —
 * 본문 전체를 로그에 쏟으면 07 하나가 12개 달 문단을 통째로 뱉어 정작 읽어야 할
 * 줄을 묻는다.
 */
function explainIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const head = issues.slice(0, 4).map((i) => {
    const path = i.path.length > 0 ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
  const rest = issues.length - head.length;
  return rest > 0 ? `${head.join(" / ")} (외 ${rest}건)` : head.join(" / ");
}

/**
 * 모델이 준 값의 **모양**만 뽑는다. 문자열은 길이로, 배열은 길이 + 첫 원소로 줄인다.
 *
 * 검증 실패의 태반은 개수 문제(items 가 3개가 아님, months 가 12개가 아님)라
 * 내용이 아니라 모양만 봐도 원인이 잡힌다. 그리고 이건 사용자가 돈 주고 산
 * 서술이라 통째로 로그에 남기고 싶지 않다.
 */
export function shapeOf(v: unknown): string {
  if (Array.isArray(v)) {
    return v.length === 0 ? "[0]" : `[${v.length}] ${shapeOf(v[0])}`;
  }
  if (v !== null && typeof v === "object") {
    const inner = Object.entries(v)
      .map(([k, x]) => `${k}: ${shapeOf(x)}`)
      .join(", ");
    return `{ ${inner} }`;
  }
  if (typeof v === "string") return `str(${v.length})`;
  return JSON.stringify(v) ?? typeof v;
}

export type FlowParseResult<K extends FlowSectionKey> =
  | { ok: true; content: FlowInterpretation[K] }
  | { ok: false; reason: string };

/**
 * 검증 결과를 **이유까지** 돌려준다.
 *
 * parseFlowSectionContent 가 null 만 돌려주던 시절, 섹션이 버려지면 로그에 남는 것은
 * "스키마 검증 실패, 버림: rising" 한 줄뿐이었다. 그 줄로는 모델이 items 를 4개 준
 * 것인지, 08 이 계산에 없는 달을 집은 것인지 알 수 없다 — 화면에서 섹션이 사라지는
 * 것을 매번 보면서도 원인을 좁힐 방법이 없었다. zod 는 이미 그 답을 들고 있었고
 * 우리가 버리고 있었다.
 */
export function safeParseFlowSectionContent<K extends FlowSectionKey>(
  key: K,
  raw: unknown,
): FlowParseResult<K> {
  const result = spec(key).schema.safeParse(raw);
  if (result.success) return { ok: true, content: result.data as FlowInterpretation[K] };
  return { ok: false, reason: explainIssues(result.error.issues) };
}

/**
 * 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션" 으로 다룬다.
 * 이유가 필요하면 safeParseFlowSectionContent 를 쓴다 — 스키마를 실제로 부르는
 * 자리는 그쪽 하나뿐이라 둘의 판정이 갈라질 수 없다.
 */
export function parseFlowSectionContent<K extends FlowSectionKey>(
  key: K,
  raw: unknown,
): FlowInterpretation[K] | null {
  const result = safeParseFlowSectionContent(key, raw);
  return result.ok ? result.content : null;
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
