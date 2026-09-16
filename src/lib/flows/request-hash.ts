// "같은 요청인가" 를 판정하는 해시. asOf 같은 매 요청 달라지는 값은 재료에 없다.
import { createHash } from "node:crypto";
import type { ContextSnapshot } from "./context";

/** 키를 재귀적으로 사전순 정렬한 JSON. 배열 순서는 유지. undefined 값은 키째 뺀다. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export interface RequestHashParts {
  flowYear: number;
  context: Omit<ContextSnapshot, "asOf">;
  evidence: unknown;
  months: unknown;
  calcVersion: number;
  promptBundleVersion: number;
}

export function requestHashOf(parts: RequestHashParts): string {
  const { asOf: _drop, ...context } = parts.context as ContextSnapshot; // 혹시 asOf 가 섞여 들어와도 뺀다
  void _drop;
  return createHash("sha256").update(stableStringify({ ...parts, context })).digest("hex");
}
