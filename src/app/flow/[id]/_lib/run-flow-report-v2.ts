import type { FlowRevisionRow } from "@/lib/flows/revisions";
import type { SpendResult } from "@/lib/tickets/spend";
import type { GenerateFailureCode, GenerateResult } from "@/app/api/flows/_lib/v2/generator";
import type { FlowGenerationInput } from "@/app/api/flows/_lib/v2/input";

export interface RunFlowReportV2Deps {
  checkLimit(userId: string): Promise<boolean>;
  spend(a: { userId: string; feature: "yearly_flow"; subjectKey: string }): Promise<SpendResult>;
  admit(revisionId: string): Promise<FlowRevisionRow | null>;
  generate(input: FlowGenerationInput): Promise<GenerateResult>;
  publish(revisionId: string, flowId: string, a: { payload: unknown; model: string; usage: unknown }): Promise<boolean>;
  fail(revisionId: string, a: { failureCode: string; validationErrors: unknown; model: string | null; usage: unknown }): Promise<boolean>;
  getActive(flowId: string): Promise<FlowRevisionRow | null>;
  model: string;
}

export type RunOutcome =
  | { kind: "rate_limited" }
  | { kind: "out_of_tickets" }
  | { kind: "published"; revision: FlowRevisionRow }
  | { kind: "failed"; code: GenerateFailureCode | "gone" };

/**
 * 한도 → 권한·차감 → admit → 모델 → 발행. v1 의 gateFlowGeneration/chargeFlowGeneration 과
 * 같은 순서·같은 근거다(한도에 걸린 요청이 이용권을 쓰면 안 된다; entitlements_unique 가
 * 재차감을 막아 실패 뒤 재시도가 공짜다). 그 래퍼는 섹션 단위 FlowGenerator 를 감싸서
 * 여기서는 못 쓴다.
 */
export async function runFlowReportV2(
  userId: string, flowId: string, pendingId: string, deps: RunFlowReportV2Deps,
): Promise<RunOutcome> {
  const t0 = Date.now();
  // 입력·리포트 본문·에러 메시지는 안 싣는다 — revisionId·결과 종류·시간·usage 뿐이다.
  const logged = (outcome: RunOutcome, usage: unknown): RunOutcome => {
    console.info("[flow-v2]", {
      revisionId: pendingId,
      kind: outcome.kind,
      ...(outcome.kind === "failed" ? { code: outcome.code } : {}),
      ms: Date.now() - t0,
      usage,
    });
    return outcome;
  };

  if (!(await deps.checkLimit(userId))) return logged({ kind: "rate_limited" }, null);
  const spent = await deps.spend({ userId, feature: "yearly_flow", subjectKey: flowId });
  if (!spent.ok) return logged({ kind: "out_of_tickets" }, null);

  const published = async (): Promise<RunOutcome | null> => {
    const active = await deps.getActive(flowId);
    return active ? { kind: "published", revision: active } : null;
  };

  const admitted = await deps.admit(pendingId);
  if (!admitted) return logged((await published()) ?? { kind: "failed", code: "gone" }, null);

  const result = await deps.generate(admitted.inputSnapshot as FlowGenerationInput);
  if (result.ok) {
    await deps.publish(admitted.id, flowId, { payload: result.report, model: deps.model, usage: result.usage });
    // publish 가 true 든 false 든 admitted 행 자체에는 published_payload 가 없다 —
    // 실제로 발행됐는지는 getActive 로 다시 읽어야 안다.
    return logged((await published()) ?? { kind: "failed", code: "gone" }, result.usage);
  }
  await deps.fail(admitted.id, { failureCode: result.code, validationErrors: result.errors, model: deps.model, usage: result.usage });
  return logged((await published()) ?? { kind: "failed", code: result.code }, result.usage);
}
