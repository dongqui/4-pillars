import { describe, expect, it } from "vitest";
import { normalizeFlowContext } from "./context";
import { requestHashOf, stableStringify } from "./request-hash";

const base = {
  flowYear: 2026,
  context: { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline" },
  evidence: { facts: [{ id: "a", kind: "natal", value: 1, monthIndex: null }] },
  months: [{ index: 1, pivot: false }],
  calcVersion: 1, promptBundleVersion: 1,
} as const;

describe("stableStringify", () => {
  it("키 순서가 달라도 같다", () => {
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(stableStringify({ a: [{ c: 2, d: 1 }], b: 1 }));
  });
  it("배열 순서는 유지한다", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
  it("undefined 값 키는 뺀다", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe("requestHashOf", () => {
  it("같은 입력이면 같은 해시, 64자 hex", () => {
    const h = requestHashOf(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(requestHashOf({ ...base })).toBe(h);
  });
  it("답 하나가 다르면 다르다", () => {
    expect(requestHashOf({ ...base, context: { ...base.context, career: "student" } })).not.toBe(requestHashOf(base));
  });
  it("normalizeFlowContext 의 asOf 만 다르면 해시는 같다 — 함수가 asOf 를 뺀다", () => {
    const answer = { career: "employed", relationship: "single", mainConcern: "overall" } as const;
    const snapshotA = normalizeFlowContext(answer, { relation: "present", now: new Date("2026-01-01T00:00:00Z") });
    const snapshotB = normalizeFlowContext(answer, { relation: "present", now: new Date("2026-06-01T00:00:00Z") });
    expect(snapshotA.asOf).not.toBe(snapshotB.asOf);
    expect(requestHashOf({ ...base, context: snapshotA })).toBe(requestHashOf({ ...base, context: snapshotB }));
  });
});
