import { describe, it, expect, vi } from "vitest";
import { analyze } from "@/lib/saju-core";
import { PromptedGenerator, type SectionTransport } from "./prompted";
import type { SectionKey } from "./sections";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });
const ctx = { year: 2026 };

const ok: SectionTransport = async () => ({ content: [{ title: "t", body: "b" }] });

describe("PromptedGenerator", () => {
  it("요청한 섹션마다 transport 를 한 번씩 부른다", async () => {
    const transport = vi.fn(ok);
    const keys: SectionKey[] = ["personality", "strengths"];
    await new PromptedGenerator("test", transport).generateSections(analysis, keys, ctx);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.map(([req]) => req.key).sort()).toEqual([...keys].sort());
  });

  it("content 를 벗겨서 돌려준다", async () => {
    const out = await new PromptedGenerator("test", ok).generateSections(
      analysis,
      ["personality"],
      ctx,
    );
    expect(out.personality).toEqual([{ title: "t", body: "b" }]);
  });

  it("한 섹션이 실패해도 나머지는 살린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport: SectionTransport = async (req) => {
      if (req.key === "strengths") throw new Error("boom");
      return { content: [{ title: "t", body: "b" }] };
    };
    const out = await new PromptedGenerator("test", transport).generateSections(
      analysis,
      ["personality", "strengths"],
      ctx,
    );
    expect(Object.keys(out)).toEqual(["personality"]);
    warn.mockRestore();
  });

  // { content } 로 감싸지 않은 응답은 계약 위반이다. 통째로 담으면
  // handleSaju 의 스키마 검증에서 어차피 떨어지지만, 여기서 먼저 버린다.
  it("content 로 감싸지 않은 응답은 버린다", async () => {
    const transport: SectionTransport = async () => [{ title: "t", body: "b" }];
    const out = await new PromptedGenerator("test", transport).generateSections(
      analysis,
      ["personality"],
      ctx,
    );
    expect(out).toEqual({});
  });

  it("기준 연도를 프롬프트에 전달한다", async () => {
    const transport = vi.fn(ok);
    await new PromptedGenerator("test", transport).generateSections(
      analysis,
      ["yearlyLuck"],
      { year: 2030 },
    );
    expect(transport.mock.calls[0][0].user).toContain("2030년");
  });

  it("세운 연수 옵션을 프롬프트에 전달한다", async () => {
    const transport = vi.fn(ok);
    await new PromptedGenerator("test", transport, { yearlyLuckYears: 1 }).generateSections(
      analysis,
      ["yearlyLuck"],
      ctx,
    );
    expect(transport.mock.calls[0][0].user).toContain("항목은 정확히 1개");
  });

  it("model 을 노출한다", () => {
    expect(new PromptedGenerator("claude-x", ok).model).toBe("claude-x");
  });

  it("키가 비면 빈 객체", async () => {
    expect(await new PromptedGenerator("test", ok).generateSections(analysis, [], ctx)).toEqual({});
  });
});
