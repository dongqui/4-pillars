import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { admitRevision, failRevision, publishRevision, toRevisionRow, upsertPendingRevision } from "./revisions";

function fakeSql(results: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, calls };
}

const snapshot = { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" } as const;
const raw = {
  id: 5, flow_id: 7, format_version: 2, prompt_bundle_version: 1, idempotency_key: "k1", request_hash: "h1",
  context_snapshot: snapshot, input_snapshot: { request: {}, personalContext: snapshot, evidence: {} },
  months_snapshot: [{ index: 1, start: "a", end: "b", korean: "경인", pivot: false }],
  phase: "draft", published_payload: null, validation_errors: null, model: null, usage_summary: null,
  failure_code: null, admitted_at: null, created_at: "2026-09-16T00:00:00.000Z", updated_at: "2026-09-16T00:00:00.000Z", published_at: null,
};
const input = { promptBundleVersion: 1, idempotencyKey: "k2", requestHash: "h1", contextSnapshot: snapshot, inputSnapshot: raw.input_snapshot, monthsSnapshot: raw.months_snapshot };

describe("toRevisionRow", () => {
  it("jsonb 가 문자열로 와도 읽는다", () => {
    const r = toRevisionRow({ ...raw, context_snapshot: JSON.stringify(snapshot), months_snapshot: JSON.stringify(raw.months_snapshot) });
    expect(r.contextSnapshot.career).toBe("employed");
    expect(r.monthsSnapshot[0].korean).toBe("경인");
  });
  it("스냅샷 모양이 아니면 던진다", () => {
    expect(() => toRevisionRow({ ...raw, months_snapshot: "[]" })).toThrow();
  });
});

describe("upsertPendingRevision", () => {
  it("INSERT 가 1행이면 created", async () => {
    const { client, calls } = fakeSql([[raw]]);
    const out = await upsertPendingRevision("7", input, client);
    expect(out).toMatchObject({ kind: "created", revision: { id: "5" } });
    expect(calls[0].text).toMatch(/FOR UPDATE/);
    expect(calls[0].text).toMatch(/ON CONFLICT \(flow_id\) WHERE phase NOT IN/);
  });
  it("충돌 + 같은 해시면 same", async () => {
    const { client } = fakeSql([[], [raw]]);
    expect(await upsertPendingRevision("7", input, client)).toMatchObject({ kind: "same" });
  });
  it("충돌 + 다른 해시 + 과금 전이면 replaced", async () => {
    const { client, calls } = fakeSql([[], [{ ...raw, request_hash: "old" }], [{ ...raw, request_hash: "h1" }]]);
    expect(await upsertPendingRevision("7", input, client)).toMatchObject({ kind: "replaced" });
    expect(calls[2].text).toMatch(/admitted_at IS NULL/);
  });
  it("충돌 + 다른 해시 + 과금 뒤면 busy", async () => {
    const { client } = fakeSql([[], [{ ...raw, request_hash: "old", admitted_at: "2026-09-16T00:00:00.000Z" }], []]);
    expect(await upsertPendingRevision("7", input, client)).toEqual({ kind: "busy" });
  });
  it("충돌했는데 pending 이 없으면 none — 500 이 아니다", async () => {
    const { client } = fakeSql([[], []]);
    expect(await upsertPendingRevision("7", input, client)).toEqual({ kind: "none" });
  });
});

describe("admit / publish / fail", () => {
  it("admit 은 RETURNING 행을 돌려주고, 없으면 null", async () => {
    expect((await admitRevision("5", fakeSql([[{ ...raw, admitted_at: "x" }]]).client))?.admittedAt).toBeInstanceOf(Date);
    expect(await admitRevision("5", fakeSql([[]]).client)).toBeNull();
  });
  it("publish 는 문장 하나로 revision 과 flows 를 함께 바꾸고, 0행이면 false", async () => {
    const { client, calls } = fakeSql([[{ id: 7 }]]);
    expect(await publishRevision("5", "7", { payload: { sections: {} }, model: "m", usage: null }, client)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/phase='draft'/);
    expect(calls[0].text).toMatch(/UPDATE flows SET active_revision_id/);
    expect(await publishRevision("5", "7", { payload: {}, model: "m", usage: null }, fakeSql([[]]).client)).toBe(false);
  });
  it("fail 은 draft 만 닫는다", async () => {
    const { client, calls } = fakeSql([[{ id: 5 }]]);
    expect(await failRevision("5", { failureCode: "schema", validationErrors: [], model: "m", usage: null }, client)).toBe(true);
    expect(calls[0].text).toMatch(/phase='draft'/);
  });
});
