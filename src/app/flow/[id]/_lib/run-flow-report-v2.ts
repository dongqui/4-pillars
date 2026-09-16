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
  if (!(await deps.checkLimit(userId))) return { kind: "rate_limited" };
  const spent = await deps.spend({ userId, feature: "yearly_flow", subjectKey: flowId });
  if (!spent.ok) return { kind: "out_of_tickets" };

  const published = async (): Promise<RunOutcome | null> => {
    const active = await deps.getActive(flowId);
    return active ? { kind: "published", revision: active } : null;
  };

  const admitted = await deps.admit(pendingId);
  if (!admitted) return (await published()) ?? { kind: "failed", code: "gone" };

  const result = await deps.generate(admitted.inputSnapshot as FlowGenerationInput);
  if (result.ok) {
    if (await deps.publish(admitted.id, flowId, { payload: result.report, model: deps.model, usage: result.usage })) {
      return (await published()) ?? { kind: "failed", code: "gone" };
    }
    return (await published()) ?? { kind: "failed", code: "gone" };
  }
  await deps.fail(admitted.id, { failureCode: result.code, validationErrors: result.errors, model: deps.model, usage: result.usage });
  return (await published()) ?? { kind: "failed", code: result.code };
}
