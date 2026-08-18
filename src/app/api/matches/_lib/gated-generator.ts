import { MatchRateLimitError, checkMatchLimit } from "@/lib/matches/rate-limit";
import { MatchTicketsError } from "@/lib/matches/tickets";
import { spendTicket, type SpendResult } from "@/lib/tickets/spend";
import type { MatchGenerator } from "./generator";

/**
 * 시간당 한도를 씌운 궁합 생성기.
 *
 * 게이트를 **생성기 자리**에 두는 이유는 report/_lib/gated-generator.ts 와 같다:
 * produceMatchSections 는 저장소에 없는 섹션이 있을 때만 생성기를 부른다. 그래서 이
 * 자리에 두면 **실제로 비용이 드는 순간에만** 카운터가 깎인다.
 *
 * 궁합에서는 이 자리가 리포트보다 더 중요하다. 만들기(POST /api/matches)에서 세면
 * 두 방향으로 다 틀린다 — 같은 쌍·같은 관계를 다시 제출하면 matches_unique 로 기존
 * 행에 수렴해 LLM 을 한 번도 부르지 않는데 한도를 1 먹고, 반대로 /match/[id] 를
 * 새로고침하면 저장이 끝나기 전까지 매번 5콜을 새로 부르는데 아무것도 세지 않는다.
 *
 * userId 를 인자로 받는다(생성기가 세션을 읽지 않는다) — 이 함수가 순수해야
 * 한도 초과에서 안쪽 생성기가 정말 안 불리는지를 테스트로 못박을 수 있다.
 */
export function gateMatchGeneration(
  inner: MatchGenerator,
  userId: string,
  checkLimit: (userId: string) => Promise<boolean> = checkMatchLimit,
): MatchGenerator {
  return {
    // 모델 식별자는 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다.
    model: inner.model,
    async generateSections(ctx, keys) {
      // 던지기 전에 inner 를 부르지 않는다. 여기서 순서가 뒤집히면 게이트는
      // "비용을 막는 것" 이 아니라 "비용을 쓴 뒤 보고하는 것" 이 된다.
      if (!(await checkLimit(userId))) throw new MatchRateLimitError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * produceMatchSections 는 생성기 예외를 MatchGenerationError 로 감싸며 원인을 cause 에
 * 넣는다. 한도에 걸린 것과 생성이 실패한 것은 사용자에게 할 말이 다르므로 갈라낸다.
 */
export function isMatchRateLimited(e: unknown): boolean {
  if (e instanceof MatchRateLimitError) return true;
  return e instanceof Error && e.cause instanceof MatchRateLimitError;
}

/**
 * 이용권을 씌운 궁합 생성기.
 *
 * 게이트를 생성기 자리에 두는 이유는 위 gateMatchGeneration 과 같다 —
 * produceMatchSections 는 저장소에 없는 섹션이 있을 때만 생성기를 부르므로,
 * 이 자리에 두면 실제로 비용이 드는 순간에만 차감된다. 이미 다 저장된 궁합을
 * 다시 여는 것은 생성기에 닿지 않아 공짜다.
 *
 * subjectKey 가 matchId 인 것이 요점이다. matches_unique 가
 * (두 프로필, 관계 유형, 두 역할) 로 잡혀 있어 같은 궁합은 항상 같은 행이고,
 * entitlements_unique 가 그 행에 두 번 차감되는 것을 막는다.
 *
 * 생성이 실패해도 되돌리지 않는다 — 권한 행이 남아 재시도가 공짜이기 때문이다.
 * (상담은 반대다: 그쪽은 상담 1건이 죽으면 되돌린다. consultations/service.ts 참조)
 */
export function spendOnMatchGeneration(
  inner: MatchGenerator,
  a: {
    userId: string;
    matchId: string;
    spend?: (i: {
      userId: string;
      feature: "compatibility";
      subjectKey: string;
    }) => Promise<SpendResult>;
  },
): MatchGenerator {
  const spend = a.spend ?? spendTicket;
  return {
    // 모델 식별자는 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다.
    model: inner.model,
    async generateSections(ctx, keys) {
      // 던지기 전에 inner 를 부르지 않는다. 여기서 순서가 뒤집히면 게이트는
      // "비용을 막는 것" 이 아니라 "비용을 쓴 뒤 보고하는 것" 이 된다.
      const r = await spend({ userId: a.userId, feature: "compatibility", subjectKey: a.matchId });
      if (!r.ok) throw new MatchTicketsError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * produceMatchSections 가 생성기 예외를 MatchGenerationError 로 감싸며 원인을
 * cause 에 넣는다. isMatchRateLimited 와 같은 이유로 갈라낸다.
 */
export function isMatchOutOfTickets(e: unknown): boolean {
  if (e instanceof MatchTicketsError) return true;
  return e instanceof Error && e.cause instanceof MatchTicketsError;
}
