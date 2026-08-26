import { getBalance } from "@/lib/tickets/wallet";
import { FEATURE_COST } from "@/lib/tickets/features";
import { peekFlowLimit } from "./rate-limit";

/**
 * 흐름을 만들 수 있는가.
 *
 * **여기서는 세지도, 깎지도 않는다(읽기만 한다).** 실제로 LLM 을 부르는 자리는
 * /flow/[id] 의 생성이고, 한도 카운터와 이용권 차감 모두 거기서 이뤄진다
 * (app/api/flows/_lib/gated-generator.ts).
 *
 * 만들기에서 같이 차감하면 같은 프로필·같은 해를 다시 제출해 flows_unique 로 기존
 * 행에 수렴하는 요청 — LLM 을 한 번도 부르지 않는 요청 — 이 한도와 이용권을 함께
 * 먹는다. (궁합의 access.ts 와 같은 판단)
 */
export type FlowAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" | "insufficient_tickets" };

export interface FlowAccessDeps {
  /** 세지 않고 보는 쪽만 주입한다 — 이름이 곧 계약이다 */
  peekLimit(userId: string): Promise<boolean>;
  /** 잔액도 읽기만 한다. 차감은 생성기 자리에서 한다 */
  getBalance(userId: string): Promise<number>;
}

const defaultDeps: FlowAccessDeps = {
  peekLimit: (id) => peekFlowLimit(id),
  getBalance: (id) => getBalance(id),
};

export async function canCreateFlow(
  userId: string | null,
  deps: FlowAccessDeps = defaultDeps,
): Promise<FlowAccess> {
  if (!userId) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.peekLimit(userId))) return { ok: false, reason: "rate_limited" };
  if ((await deps.getBalance(userId)) < FEATURE_COST.current_flow) {
    return { ok: false, reason: "insufficient_tickets" };
  }
  return { ok: true };
}
