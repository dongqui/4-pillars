import { FlowRateLimitError, checkFlowLimit } from "@/lib/flows/rate-limit";
import { FlowTicketsError } from "@/lib/flows/tickets";
import { spendTicket, type SpendResult } from "@/lib/tickets/spend";
import type { FlowGenerator } from "./generator";

/**
 * 시간당 한도를 씌운 흐름 생성기.
 *
 * 게이트를 **생성기 자리**에 두는 이유는 궁합·리포트와 같다: produceFlowSections 는
 * 저장소에 없는 섹션이 있을 때만 생성기를 부른다. 그래서 이 자리에 두면 **실제로
 * 비용이 드는 순간에만** 카운터가 깎인다.
 *
 * userId 를 인자로 받는다(생성기가 세션을 읽지 않는다) — 이 함수가 순수해야
 * 한도 초과에서 안쪽 생성기가 정말 안 불리는지를 테스트로 못박을 수 있다.
 */
export function gateFlowGeneration(
  inner: FlowGenerator,
  userId: string,
  checkLimit: (userId: string) => Promise<boolean> = checkFlowLimit,
): FlowGenerator {
  return {
    // 모델 식별자는 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다.
    model: inner.model,
    async generateSections(ctx, keys) {
      // 던지기 전에 inner 를 부르지 않는다. 순서가 뒤집히면 게이트는 "비용을 막는 것"
      // 이 아니라 "비용을 쓴 뒤 보고하는 것" 이 된다.
      if (!(await checkLimit(userId))) throw new FlowRateLimitError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * 이용권을 씌운 흐름 생성기.
 *
 * subjectKey 가 flowId 인 것이 요점이다. flows_unique 가 (프로필, 명리 연도)로 잡혀
 * 있어 같은 해의 흐름은 항상 같은 행이고, entitlements_unique 가 그 행에 두 번
 * 차감되는 것을 막는다. **기간별 권한이 여기서 저절로 나온다** — 흐름이 넘어가면
 * 새 flow_year → 새 행 → 새 subject_key → 새 결제다.
 *
 * 생성이 실패해도 되돌리지 않는다 — 권한 행이 남아 재시도가 공짜이기 때문이다.
 * (상담은 반대다: 그쪽은 상담 1건이 죽으면 되돌린다)
 *
 * **합성 순서: gateFlowGeneration 을 바깥에, chargeFlowGeneration 을 안에 둔다** —
 * `gateFlowGeneration(chargeFlowGeneration(inner, ...), ...)`. 한도 확인이 이용권
 * 차감보다 먼저 일어나야 한도에 걸린 요청이 이용권을 쓰지 않는다. 반대로 감싸면
 * (이용권 바깥·한도 안쪽) 이용권부터 깎고 나서야 한도 초과를 알게 되어, 정작 막아야
 * 할 요청에서 먼저 돈을 받는 꼴이 된다.
 */
export function chargeFlowGeneration(
  inner: FlowGenerator,
  userId: string,
  flowId: string,
  spend: (a: {
    userId: string;
    feature: "current_flow";
    subjectKey: string;
  }) => Promise<SpendResult> = spendTicket,
): FlowGenerator {
  return {
    model: inner.model,
    async generateSections(ctx, keys) {
      const result = await spend({ userId, feature: "current_flow", subjectKey: flowId });
      if (!result.ok) throw new FlowTicketsError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * produceFlowSections 는 생성기 예외를 FlowGenerationError 로 감싸며 원인을 cause 에
 * 넣는다. 한도에 걸린 것과 생성이 실패한 것은 사용자에게 할 말이 다르므로 갈라낸다.
 */
export function isFlowRateLimited(e: unknown): boolean {
  if (e instanceof FlowRateLimitError) return true;
  return e instanceof Error && e.cause instanceof FlowRateLimitError;
}

/** 위와 같은 이유로 이용권 부족도 갈라낸다. */
export function isFlowOutOfTickets(e: unknown): boolean {
  if (e instanceof FlowTicketsError) return true;
  return e instanceof Error && e.cause instanceof FlowTicketsError;
}
