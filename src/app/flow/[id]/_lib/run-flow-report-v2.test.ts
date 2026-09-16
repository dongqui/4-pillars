import { afterEach, describe, expect, it, vi } from "vitest";
import { runFlowReportV2, type RunFlowReportV2Deps } from "./run-flow-report-v2";
import { makeValidFlowReportFixture } from "@/app/api/flows/_lib/v2/__fixtures__/reports";

const rev = (o: Partial<{ id: string; inputSnapshot: unknown }> = {}) =>
  ({ id: "5", flowId: "7", inputSnapshot: { marker: "admitted" }, ...o }) as never;

function deps(o: Partial<RunFlowReportV2Deps> = {}) {
  const log: string[] = [];
  const d: RunFlowReportV2Deps = {
    checkLimit: async () => { log.push("limit"); return true; },
    spend: async () => { log.push("spend"); return { ok: true, kind: "spent", balance: 1 }; },
    admit: async () => { log.push("admit"); return rev(); },
    generate: async (input) => {
      log.push(`generate:${(input as unknown as { marker: string }).marker}`);
      return { ok: true, report: makeValidFlowReportFixture(), usage: null };
    },
    publish: async () => { log.push("publish"); return true; },
    fail: async () => { log.push("fail"); return true; },
    getActive: async () => { log.push("active"); return null; },
    model: "m",
    ...o,
  };
  return { d, log };
}

describe("runFlowReportV2 — 실행 로그", () => {
  afterEach(() => vi.restoreAllMocks());

  it("결과 하나마다 구조화 로그 한 번 — report 본문은 안 싣는다", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { d } = deps({ getActive: async () => rev() });
    const out = await runFlowReportV2("3", "7", "5", d);
    expect(out.kind).toBe("published");

    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, payload] = spy.mock.calls[0];
    expect(tag).toBe("[flow-v2]");
    expect(payload).toMatchObject({ revisionId: "5", kind: "published" });

    const serialized = JSON.stringify(spy.mock.calls[0]);
    expect(serialized).not.toContain("총운");
  });
});

describe("runFlowReportV2", () => {
  it("한도→권한→admit→모델→발행, 입력은 admit 이 돌려준 행", async () => {
    const { d, log } = deps({ getActive: async () => { log.push("active"); return rev(); } });
    const out = await runFlowReportV2("3", "7", "5", d);
    expect(out.kind).toBe("published");
    expect(log).toEqual(["limit", "spend", "admit", "generate:admitted", "publish", "active"]);
  });

  it("한도 초과면 그 뒤가 안 불린다", async () => {
    const { d, log } = deps({ checkLimit: async () => { log.push("limit"); return false; } });
    expect((await runFlowReportV2("3", "7", "5", d)).kind).toBe("rate_limited");
    expect(log).toEqual(["limit"]);
  });

  it("잔액 부족이면 모델이 안 불린다", async () => {
    const { d, log } = deps({ spend: async () => ({ ok: false, kind: "insufficient", balance: 0 }) });
    expect((await runFlowReportV2("3", "7", "5", d)).kind).toBe("out_of_tickets");
    expect(log).not.toContain("generate:admitted");
  });

  it("admit null → active 있으면 published, 없으면 failed(gone)", async () => {
    expect((await runFlowReportV2("3", "7", "5", deps({ admit: async () => null, getActive: async () => rev() }).d)).kind).toBe(
      "published",
    );
    expect(await runFlowReportV2("3", "7", "5", deps({ admit: async () => null }).d)).toEqual({ kind: "failed", code: "gone" });
  });

  it("publish false → active 있으면 published, 없으면 failed(gone)", async () => {
    expect((await runFlowReportV2("3", "7", "5", deps({ publish: async () => false, getActive: async () => rev() }).d)).kind).toBe(
      "published",
    );
    expect(await runFlowReportV2("3", "7", "5", deps({ publish: async () => false }).d)).toEqual({ kind: "failed", code: "gone" });
  });

  it("생성 실패 → fail 뒤 active 있으면 published, 없으면 failed(code)", async () => {
    const gen = async () => ({ ok: false as const, code: "schema" as const, errors: [], usage: null });
    expect((await runFlowReportV2("3", "7", "5", deps({ generate: gen, getActive: async () => rev() }).d)).kind).toBe("published");
    const { d, log } = deps({ generate: gen });
    expect(await runFlowReportV2("3", "7", "5", d)).toEqual({ kind: "failed", code: "schema" });
    expect(log).toContain("fail");
  });
});
