import { describe, expect, it } from "vitest";
import type { FlowContext } from "./prompt";
import { produceFlowSections, FlowGenerationError } from "./produce";
import type { SqlClient } from "./store";
import { FLOW_SECTIONS, type FlowSectionKey } from "./sections";

// pivotMonths 만 있으면 충분하다 — produceFlowSections 는 이 필드만 읽어
// schemaCtx 를 만든다. 나머지 FlowContext 필드는 프롬프트 조립에만 쓰인다.
const ctx = { pivotMonths: [3, 7] } as unknown as FlowContext;
const good = {
  title: "제목",
  body: "본문",
  keywords: ["가", "나", "다", "라"],
};

/**
 * 실제 DB 대신 결정적인 행을 돌려주는 가짜 클라이언트 — store.test.ts,
 * src/lib/flows/store.test.ts 와 같은 패턴이다.
 *
 * getStored 를 모킹하던 이전 버전과 달리, 여기서는 produceFlowSections 가
 * 직접 부르는 getFlowSections(→ decodeFlowSections)의 실제 스키마 검증을
 * 그대로 통과한다 — 그래서 아래 row() 헬퍼가 실제 FLOW_SECTIONS 버전과 실제
 * ctx.pivotMonths 도메인에 맞는 content 를 넣어야 한다.
 */
function fakeClient(rows: Record<string, unknown>[]): SqlClient {
  return (async () => rows) as unknown as SqlClient;
}

const row = (key: FlowSectionKey, content: unknown) => ({
  section_key: key,
  schema_version: FLOW_SECTIONS[key].version,
  content: JSON.stringify(content),
});

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
      putStored: async () => {},
      sectionKeys: ["overview"],
      client: fakeClient([row("overview", good)]),
    });
    expect(called).toBe(false);
    expect(out.stored).toBe(true);
    expect(out.interpretation.overview).toEqual(good);
  });

  // monthIndex 5 는 ctx.pivotMonths=[3,7] 밖이다 — schemaCtx 가 ctx.pivotMonths
  // 를 실제로 쓰는지를 이 테스트가 가른다.
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
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["pivots"],
      client: fakeClient([]),
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
      putStored: async () => {},
      sectionKeys: ["overview"],
      client: fakeClient([]),
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
        putStored: async () => {},
        sectionKeys: ["overview", "rising"],
        client: fakeClient([row("overview", good)]),
      }),
    ).rejects.toMatchObject({ partial: { overview: good } });
  });

  it("FlowGenerationError 는 원인을 cause 에 담는다", () => {
    const cause = new Error("inner");
    expect(new FlowGenerationError(cause, {}).cause).toBe(cause);
  });

  /**
   * 이 테스트가 지키는 것: produceFlowSections 가 저장소를 읽을 때 쓰는
   * 스키마 컨텍스트와, 읽어온 값을 검증할 때 쓰는 스키마 컨텍스트가 *같은*
   * 값이라는 것.
   *
   * 저장된 08 행은 실제 ctx.pivotMonths=[3,7] 과 정확히 맞아떨어진다. 두
   * 컨텍스트가 어긋나면(예: 읽기 쪽에 빈 배열이 새어 들어가면) 이 행의
   * monthIndex 3·7 이 읽기에 쓰인 도메인 밖이 되어 손상으로 판정되고,
   * missing 이 비지 않아 생성기가 불린다 — 방금 산 서술을 조회할 때마다
   * 다시 만드는 것과 같은 모양이다(지갑은 entitlements 행이 남아 안전하지만
   * LLM 호출은 매번 든다).
   *
   * 이 테스트는 실제로 어긋남을 잡는다 — produce.ts 에서
   * `getFlowSections(flowId, deps.sectionKeys, schemaCtx, deps.client)` 의
   * schemaCtx 를 `{ pivotMonths: [] }` 로 바꿔 두면(검증 쪽 schemaCtx 는
   * 그대로 둔 채) 이 테스트는 실패한다 — generatorCalled 가 true 가 되고
   * out.stored 가 false 가 된다. 리뷰에서 확인한 뒤 원복했다.
   */
  it("읽기와 검증이 같은 스키마 컨텍스트를 쓴다 — 어긋나면 방금 저장한 것도 missing 으로 떨어진다", async () => {
    let generatorCalled = false;
    const pivotsGood = {
      lead: "l",
      pivots: [
        { monthIndex: 3, title: "t", body: "b" },
        { monthIndex: 7, title: "t", body: "b" },
      ],
    };

    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          generatorCalled = true;
          return {};
        },
      },
      putStored: async () => {},
      sectionKeys: ["pivots"],
      client: fakeClient([row("pivots", pivotsGood)]),
    });

    expect(generatorCalled).toBe(false);
    expect(out.stored).toBe(true);
    expect(out.interpretation.pivots).toEqual(pivotsGood);
  });
});
