import { describe, expect, it, vi } from "vitest";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import { MatchGenerationError, produceMatchSections } from "./produce";
import type { MatchContext } from "./prompt";

const a = analyze({ year: 1990, month: 10, day: 25, hour: 10, minute: 0, gender: "male", calendar: "solar" });
const b = analyze({ year: 1993, month: 4, day: 12, hour: 10, minute: 0, gender: "female", calendar: "solar" });
const ctx: MatchContext = {
  subject: a, counterpart: b, synastry: analyzeSynastry(a, b),
  relation: { type: null, subjectRole: null, counterpartRole: null },
};
const verdict = { headline: "가", summary: "나" };

describe("produceMatchSections", () => {
  it("저장된 것이 전부면 생성기를 부르지 않는다", async () => {
    const generateSections = vi.fn();
    const out = await produceMatchSections("1", ctx, {
      generator: { model: "m", generateSections },
      getStored: async () => ({ have: { verdict }, missing: [] }),
      putStored: async () => {},
      sectionKeys: ["verdict"],
    });
    expect(generateSections).not.toHaveBeenCalled();
    expect(out.stored).toBe(true);
  });

  it("없는 섹션만 생성한다", async () => {
    // moments 는 최소 2개인데 목이 1개만 줘서 검증에서 걸린다 — 이 테스트가
    // 보는 건 호출 인자뿐이라 상관없지만, 그 경고가 콘솔을 더럽히지 않게 죽인다.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateSections = vi.fn().mockResolvedValue({ moments: [{ label: "가", body: "나" }] });
    await produceMatchSections("1", ctx, {
      generator: { model: "m", generateSections },
      getStored: async () => ({ have: { verdict }, missing: ["moments"] }),
      putStored: async () => {},
      sectionKeys: ["verdict", "moments"],
    });
    expect(generateSections).toHaveBeenCalledWith(ctx, ["moments"]);
    warn.mockRestore();
  });

  it("스키마에 맞지 않는 생성 결과는 버린다 — 응답과 저장 양쪽을 한 자리에서 막는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const put = vi.fn();
    const out = await produceMatchSections("1", ctx, {
      generator: { model: "m", generateSections: async () => ({ verdict: { headline: "" } as never }) },
      getStored: async () => ({ have: {}, missing: ["verdict"] }),
      putStored: put,
      sectionKeys: ["verdict"],
    });
    expect(out.interpretation.verdict).toBeUndefined();
    expect(put).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("생성 실패는 이미 확보한 섹션을 싣고 던진다", async () => {
    const promise = produceMatchSections("1", ctx, {
      generator: { model: "m", generateSections: async () => { throw new Error("down"); } },
      getStored: async () => ({ have: { verdict }, missing: ["moments"] }),
      putStored: async () => {},
      sectionKeys: ["verdict", "moments"],
    });
    await expect(promise).rejects.toBeInstanceOf(MatchGenerationError);
    await promise.catch((e: MatchGenerationError) => {
      expect(e.partial.verdict).toEqual(verdict);
    });
  });
});
