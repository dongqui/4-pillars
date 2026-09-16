import { describe, expect, it } from "vitest";
import { DeepSeekHttpError, DeepSeekTimeoutError } from "@/app/api/saju/_lib/deepseek";
import { generateFlowReportV2 } from "./generator";
import { buildFlowGenerationInput } from "./input";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "./__fixtures__/reports";

const evidence = makeEvidenceFixture();
const input = buildFlowGenerationInput({
  flowYear: 2027, relation: "future", evidence, months: [],
  snapshot: { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" },
});
const transportOf = (impl: () => Promise<unknown>) => {
  let calls = 0;
  return { t: { send: async () => { calls++; return impl(); }, takeUsage: () => ({ total_tokens: 1 }) }, calls: () => calls };
};

describe("generateFlowReportV2", () => {
  it("성공 — content 언랩 없이 tool 인자 자체가 report", async () => {
    const { t, calls } = transportOf(async () => makeValidFlowReportFixture(evidence));
    const r = await generateFlowReportV2(input, t);
    expect(r.ok).toBe(true);
    expect(calls()).toBe(1);
    if (r.ok) expect(r.usage).toEqual({ total_tokens: 1 });
  });
  it("timeout / http / transport 를 가른다 — errors 에 message·본문이 없다", async () => {
    const body = "모델이 낸 긴 본문";
    for (const [err, code] of [
      [new DeepSeekTimeoutError("report", 45_000), "timeout"],
      [new DeepSeekHttpError(429, body), "http"],
      [new Error(`DeepSeek tool arguments 가 JSON 이 아니다 (report): ${body}`), "transport"],
    ] as const) {
      const { t } = transportOf(async () => { throw err; });
      const r = await generateFlowReportV2(input, t);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe(code);
        expect(JSON.stringify(r.errors)).not.toContain(body);
        expect(JSON.stringify(r.errors)).not.toContain("message");
      }
    }
  });
  it("schema 실패는 이슈 경로만", async () => {
    const bad = makeValidFlowReportFixture(evidence) as unknown as { sections: { closing: unknown } };
    bad.sections.closing = { items: [] };
    const { t } = transportOf(async () => bad);
    const r = await generateFlowReportV2(input, t);
    expect(r).toMatchObject({ ok: false, code: "schema" });
  });
  it("references 실패", async () => {
    const bad = makeValidFlowReportFixture(evidence);
    bad.sections.money.basisRefs = ["nope"];
    const { t } = transportOf(async () => bad);
    expect(await generateFlowReportV2(input, t)).toMatchObject({ ok: false, code: "references", errors: ["/sections/money: nope"] });
  });
});
