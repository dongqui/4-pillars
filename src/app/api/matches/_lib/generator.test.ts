import { describe, expect, it, vi } from "vitest";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import { PromptedMatchGenerator, type MatchTransport } from "./generator";
import type { MatchContext } from "./prompt";

const a = analyze({ year: 1990, month: 10, day: 25, hour: 10, minute: 0, gender: "male", calendar: "solar" });
const b = analyze({ year: 1993, month: 4, day: 12, hour: 10, minute: 0, gender: "female", calendar: "solar" });
const ctx: MatchContext = {
  subject: a, counterpart: b, synastry: analyzeSynastry(a, b),
  relation: { type: null, subjectRole: null, counterpartRole: null },
};

describe("PromptedMatchGenerator", () => {
  it("한 섹션이 실패해도 나머지는 살린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport: MatchTransport = async (req) => {
      if (req.key === "chemistry") throw new Error("down");
      return { content: { headline: "가", summary: "나" } };
    };
    const out = await new PromptedMatchGenerator("m", transport).generateSections(ctx, [
      "verdict",
      "chemistry",
    ]);
    expect(Object.keys(out)).toEqual(["verdict"]);
    expect(out.verdict).toEqual({ headline: "가", summary: "나" });
    expect(out.chemistry).toBeUndefined();
    warn.mockRestore();
  });

  it("content 로 감싸지 않은 응답은 그 키를 아예 담지 않는다", async () => {
    const transport: MatchTransport = async () => ({ headline: "가", summary: "나" });
    const out = await new PromptedMatchGenerator("m", transport).generateSections(ctx, ["verdict"]);
    expect(out).toEqual({});
    expect("verdict" in out).toBe(false);
  });

  it("스키마 검증은 하지 않는다 — produceMatchSections 가 저장 직전에 한 곳에서 건다", async () => {
    const invalid = { headline: "" };
    const transport: MatchTransport = async () => ({ content: invalid });
    const out = await new PromptedMatchGenerator("m", transport).generateSections(ctx, ["verdict"]);
    expect(out.verdict).toEqual(invalid);
  });
});
