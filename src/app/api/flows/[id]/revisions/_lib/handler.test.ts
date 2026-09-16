import { describe, expect, it } from "vitest";
import { handleRetryRevision, type RetryDeps } from "./handler";

const rev = (phase: string, id = "5") => ({
  id, flowId: "7", phase, contextSnapshot: {}, inputSnapshot: {}, monthsSnapshot: [{}],
  promptBundleVersion: 1, requestHash: "h",
}) as never;
const base: RetryDeps = {
  getFlow: async () => ({ id: "7" }) as never,
  getActiveRevision: async () => null,
  findPendingRevision: async () => null,
  findLatestRevision: async () => null,
  upsertPendingRevision: async () => ({ kind: "created", revision: rev("draft", "9") }),
  randomUUID: () => "u",
};
const d = (o: Partial<RetryDeps> = {}) => ({ ...base, ...o });
const call = (deps: RetryDeps, raw: unknown = {}) => handleRetryRevision({ userId: "3", flowId: "7", raw }, deps);

describe("handleRetryRevision", () => {
  it("본문은 {} 만", async () => expect((await call(d(), { a: 1 })).status).toBe(400));

  it("남의 flow → 404", async () => expect((await call(d({ getFlow: async () => null }))).status).toBe(404));

  it("active 있으면 409", async () =>
    expect(await call(d({ getActiveRevision: async () => rev("complete") }))).toMatchObject({
      status: 409, body: { error: "flow_v2_not_applicable" },
    }));

  it("pending 있으면 200 그 id", async () =>
    expect(await call(d({ findPendingRevision: async () => rev("draft") }))).toEqual({
      status: 200, body: { revisionId: "5" },
    }));

  it("latest 가 failed 면 스냅샷을 베껴 새 pending 201", async () => {
    let seen: { requestHash: string; idempotencyKey: string } | undefined;
    const out = await call(d({
      findLatestRevision: async () => rev("failed"),
      upsertPendingRevision: async (_f, input) => {
        seen = input as never;
        return { kind: "created", revision: rev("draft", "9") };
      },
    }));
    expect(out).toEqual({ status: 201, body: { revisionId: "9" } });
    expect(seen).toMatchObject({ requestHash: "h", idempotencyKey: "u" });
  });

  it("revision 이 없으면(v1) 409", async () => expect((await call(d())).status).toBe(409));
});
