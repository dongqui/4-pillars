import { z } from "zod";
import type { FlowRevisionRow, PendingRevisionInput, UpsertResult } from "@/lib/flows/revisions";
import type { FlowRow } from "@/lib/flows/store";

export interface RetryDeps {
  getFlow(userId: string, id: string): Promise<FlowRow | null>;
  getActiveRevision(flowId: string): Promise<FlowRevisionRow | null>;
  findPendingRevision(flowId: string): Promise<FlowRevisionRow | null>;
  findLatestRevision(flowId: string): Promise<FlowRevisionRow | null>;
  upsertPendingRevision(flowId: string, input: PendingRevisionInput): Promise<UpsertResult>;
  randomUUID(): string;
}

const NA = { status: 409, body: { error: "flow_v2_not_applicable" } };

/** 실패한 v2 시도를 다시 pending 으로. 플래그를 보지 않는다 — 이미 이용권을 낸 사용자의 길이다. */
export async function handleRetryRevision(
  a: { userId: string; flowId: string; raw: unknown },
  deps: RetryDeps,
): Promise<{ status: number; body: unknown }> {
  if (!z.object({}).strict().safeParse(a.raw).success) {
    return { status: 400, body: { error: "요청 형식이 올바르지 않습니다" } };
  }
  if (!(await deps.getFlow(a.userId, a.flowId))) {
    return { status: 404, body: { error: "흐름을 찾을 수 없습니다" } };
  }
  if (await deps.getActiveRevision(a.flowId)) return NA;

  const pending = await deps.findPendingRevision(a.flowId);
  if (pending) return { status: 200, body: { revisionId: pending.id } };

  const latest = await deps.findLatestRevision(a.flowId);
  if (!latest || latest.phase !== "failed") return NA;

  const up = await deps.upsertPendingRevision(a.flowId, {
    promptBundleVersion: latest.promptBundleVersion,
    idempotencyKey: deps.randomUUID(),
    requestHash: latest.requestHash,
    contextSnapshot: latest.contextSnapshot,
    inputSnapshot: latest.inputSnapshot,
    monthsSnapshot: latest.monthsSnapshot,
  });
  if (up.kind === "none" || up.kind === "busy") return NA;
  return { status: up.kind === "created" ? 201 : 200, body: { revisionId: up.revision.id } };
}
