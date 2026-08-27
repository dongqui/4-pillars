import { describe, expect, it } from "vitest";
import type { FlowContext } from "./prompt";
import { produceFlowSections, FlowGenerationError } from "./produce";

// pivotMonths 만 있으면 충분하다 — produceFlowSections 는 이 필드만 읽어
// schemaCtx 를 만든다. 나머지 FlowContext 필드는 프롬프트 조립에만 쓰인다.
const ctx = { pivotMonths: [3, 7] } as unknown as FlowContext;
const good = {
  title: "제목",
  body: "본문",
  keywords: ["가", "나", "다", "라"],
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
      getStored: async () => ({ have: { overview: good }, missing: [] }),
      putStored: async () => {},
      sectionKeys: ["overview"],
    });
    expect(called).toBe(false);
    expect(out.stored).toBe(true);
  });

  // monthIndex 5 는 ctx.pivotMonths=[3,7] 밖이다 — schemaCtx 가 ctx.pivotMonths
  // 를 실제로 쓰는지, n 대신 잘못 배선되지 않았는지를 이 테스트가 가른다.
  it("ctx.pivotMonths 밖의 달을 우기면 검증에서 버린다 — 화면과 저장 양쪽에 새지 않게", async () => {
    let saved: unknown = null;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          return {
            pivots: { lead: "l", pivots: [{ monthIndex: 5, title: "t", body: "b" }] },
          } as never;
        },
      },
      getStored: async () => ({ have: {}, missing: ["pivots"] }),
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["pivots"],
    });
    expect(out.interpretation.pivots).toBeUndefined();
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
          return { overview: good };
        },
      },
      getStored: async () => ({ have: {}, missing: ["overview"] }),
      putStored: async () => {},
      sectionKeys: ["overview"],
    });
    expect(out.interpretation.overview).toEqual(good);
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
        getStored: async () => ({ have: { overview: good }, missing: ["rising"] }),
        putStored: async () => {},
        sectionKeys: ["overview", "rising"],
      }),
    ).rejects.toMatchObject({ partial: { overview: good } });
  });

  it("FlowGenerationError 는 원인을 cause 에 담는다", () => {
    const cause = new Error("inner");
    expect(new FlowGenerationError(cause, {}).cause).toBe(cause);
  });
});
