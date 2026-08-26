import { describe, expect, it } from "vitest";
import type { FlowContext } from "./prompt";
import { produceFlowSections, FlowGenerationError } from "./produce";

const ctx = { segments: [{ id: "segment_1" }] } as unknown as FlowContext;
const good = {
  common: "배경",
  segments: [{ segmentId: "segment_1" as const, title: "가", body: "나" }],
};

describe("produceFlowSections", () => {
  it("다 저장돼 있으면 생성기를 부르지 않는다", async () => {
    let called = false;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          called = true;
          return {};
        },
      },
      getStored: async () => ({ have: { now: good }, missing: [] }),
      putStored: async () => {},
      sectionKeys: ["now"],
    });
    expect(called).toBe(false);
    expect(out.stored).toBe(true);
  });

  it("스키마를 통과 못 한 섹션은 버린다 — 화면과 저장 양쪽에 새지 않게", async () => {
    let saved: unknown = null;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          return { now: { common: "", segments: [] } } as never;
        },
      },
      getStored: async () => ({ have: {}, missing: ["now"] }),
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["now"],
    });
    expect(out.interpretation.now).toBeUndefined();
    expect(saved).toEqual({});
    // 검증에서 전부 버려져 결과가 비어 있어도, 생성을 시도한 이상 "캐시 적중" 이
    // 아니다 — stored 는 여전히 false 여야 한다.
    expect(out.stored).toBe(false);
  });

  it("생성을 시도했으면 전부 성공해도 stored 는 false다 — 캐시 적중이 아니라서다", async () => {
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          return { now: good };
        },
      },
      getStored: async () => ({ have: {}, missing: ["now"] }),
      putStored: async () => {},
      sectionKeys: ["now"],
    });
    expect(out.interpretation.now).toEqual(good);
    expect(out.stored).toBe(false);
  });

  it("생성기가 죽으면 이미 확보한 섹션을 실어 던진다", async () => {
    await expect(
      produceFlowSections("7", ctx, {
        generator: {
          model: "m",
          async generateSections() {
            throw new Error("boom");
          },
        },
        getStored: async () => ({ have: { now: good }, missing: ["rising"] }),
        putStored: async () => {},
        sectionKeys: ["now", "rising"],
      }),
    ).rejects.toMatchObject({ partial: { now: good } });
  });

  it("FlowGenerationError 는 원인을 cause 에 담는다", () => {
    const cause = new Error("inner");
    expect(new FlowGenerationError(cause, {}).cause).toBe(cause);
  });
});
