import { describe, expect, it } from "vitest";
import type { FlowContext } from "./prompt";
import { produceFlowSections, FlowGenerationError } from "./produce";
import type { SqlClient } from "./store";
import { FLOW_SECTIONS, type FlowSectionKey } from "./sections";

// produceFlowSections 는 ctx 를 생성기에 그대로 넘길 뿐 직접 읽지 않는다 —
// 프롬프트 조립은 생성기 몫이고 여기 가짜 생성기는 ctx 를 안 본다.
const ctx = {} as unknown as FlowContext;
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
 * 그대로 통과한다 — 그래서 아래 row() 헬퍼가 실제 FLOW_SECTIONS 버전에 맞는
 * content 를 넣어야 한다.
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

  it("스키마를 어긴 응답은 검증에서 버린다 — 화면과 저장 양쪽에 새지 않게", async () => {
    let saved: unknown = null;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          // items 가 3개가 아니다 — withItems 스키마 위반
          return {
            rising: { lead: "l", items: [{ title: "t", body: "b" }] },
          } as never;
        },
      },
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["rising"],
      client: fakeClient([]),
    });
    expect(out.interpretation.rising).toBeUndefined();
    expect(saved).toEqual({});
    // 검증에서 전부 버려져 결과가 비어 있어도, 생성을 시도한 이상 "캐시 적중" 이
    // 아니다 — stored 는 여전히 false 여야 한다.
    expect(out.stored).toBe(false);
  });

  it("레지스트리에 없는 키(구 pivots 등)는 생성기가 돌려줘도 버린다", async () => {
    // 08 삭제 후 남을 수 있는 두 경로를 함께 막는다 — DB 의 옛 pivots 행은
    // decodeFlowSections 의 isFlowSectionKey 가, 생성기가 뱉는 모르는 키는
    // 여기 검증 루프가 거른다.
    let saved: unknown = null;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          return {
            overview: good,
            pivots: { lead: "l", pivots: [] },
          } as never;
        },
      },
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["overview"],
      client: fakeClient([]),
    });
    expect(out.interpretation).toEqual({ overview: good });
    expect(saved).toEqual({ overview: good });
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
});
