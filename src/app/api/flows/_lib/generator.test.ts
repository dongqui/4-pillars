import { describe, expect, it, vi } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "./pivots";
import { PromptedFlowGenerator, type FlowTransport } from "./generator";
import { buildFlowContext } from "./prompt";

const a = analyze({
  year: 1993,
  month: 4,
  day: 12,
  hour: 9,
  minute: 20,
  gender: "male",
  calendar: "solar",
});
const ctx = buildFlowContext(a, 2027, flowMonths(a, 2027), null);

/** 재시도 대기 없이 만든다 — 기본값(RETRY_DELAY_MS)이면 테스트가 그만큼 잔다. */
const gen = (t: FlowTransport) => new PromptedFlowGenerator("m", t, 0);

describe("PromptedFlowGenerator · 재시도", () => {
  it("첫 전송이 실패해도 다시 보내 그 섹션을 살린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let tries = 0;
    const transport: FlowTransport = async () => {
      tries += 1;
      if (tries === 1) throw new Error("429");
      return { content: { lead: "가", items: [] } };
    };

    const out = await gen(transport).generateSections(ctx, ["rising"]);

    expect(tries).toBe(2);
    expect(out.rising).toEqual({ lead: "가", items: [] });
    warn.mockRestore();
  });

  it("성공한 섹션은 다시 보내지 않는다", async () => {
    const transport = vi.fn(async () => ({ content: { lead: "가", items: [] } }));

    await gen(transport).generateSections(ctx, ["rising", "straining"]);

    // 섹션당 정확히 한 번. 재시도가 성공 경로까지 번지면 매 열람 비용이 두 배가 된다.
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("정해진 횟수를 다 쓰고도 실패하면 그 섹션만 버리고 나머지는 남긴다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: string[] = [];
    const transport: FlowTransport = async (req) => {
      seen.push(req.key);
      if (req.key === "rising") throw new Error("down");
      return { content: { lead: "가", items: [] } };
    };

    const out = await gen(transport).generateSections(ctx, ["rising", "straining"]);

    // rising 은 두 번(첫 시도 + 재시도), straining 은 한 번
    expect(seen.filter((k) => k === "rising")).toHaveLength(2);
    expect(seen.filter((k) => k === "straining")).toHaveLength(1);
    expect(Object.keys(out)).toEqual(["straining"]);
    expect(out.rising).toBeUndefined();
    warn.mockRestore();
  });

  it("content 로 감싸지 않은 응답은 그 키를 아예 담지 않는다", async () => {
    // 전송은 성공이라 재시도 대상이 아니다 — 여기서 다시 보내면 tool 호출을
    // 빼먹는 모델 하나에 매번 두 배를 쓰게 된다.
    const transport = vi.fn(async () => ({ lead: "가", items: [] }));

    const out = await gen(transport).generateSections(ctx, ["rising"]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(out).toEqual({});
    expect("rising" in out).toBe(false);
  });

  it("스키마 검증은 하지 않는다 — produceFlowSections 가 저장 직전에 한 곳에서 건다", async () => {
    const invalid = { lead: "" };
    const transport: FlowTransport = async () => ({ content: invalid });

    const out = await gen(transport).generateSections(ctx, ["rising"]);

    expect(out.rising).toEqual(invalid);
  });
});
