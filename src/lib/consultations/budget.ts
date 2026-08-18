// 턴 예산과 상태 전이. 순수 함수만 둔다 — DB 도 LLM 도 모른다.

/** 상담 1건의 기본 턴 수(사용자 발화 기준). 새 상담의 turn_limit 에 박힌다 */
export const DEFAULT_TURN_LIMIT = 10;

/**
 * 한 상담에서 차감 없이 쓸 수 있는 위기 턴 수.
 *
 * 한도가 필요한 이유: 위기 턴을 무제한 미차감으로 두면 모델이 crisis 를 남발하거나
 * 사용자가 그렇게 유도해 무한히 무료 턴을 얻는 길이 열린다. 한도를 넘겨도 안내는
 * 그대로 하되 차감만 정상화한다 — 안내를 끊지 않으면서 구멍만 막는다.
 */
export const MAX_FREE_CRISIS_TURNS = 3;

export interface TurnState {
  turnsUsed: number;
  turnLimit: number;
  status: "open" | "closed";
}

export type TurnDecision =
  | { kind: "allowed"; remaining: number; isLast: boolean }
  | { kind: "exhausted" };

/** 이번 발화를 받아도 되는지, 받는다면 몇 번 남았는지 */
export function decideTurn(state: TurnState): TurnDecision {
  if (state.status === "closed") return { kind: "exhausted" };
  const remaining = state.turnLimit - state.turnsUsed;
  if (remaining <= 0) return { kind: "exhausted" };
  return { kind: "allowed", remaining, isLast: remaining === 1 };
}

export function nextState(
  state: TurnState,
  opts: { crisis: boolean; crisisSoFar: number },
): TurnState {
  const free = opts.crisis && opts.crisisSoFar < MAX_FREE_CRISIS_TURNS;
  const turnsUsed = free ? state.turnsUsed : state.turnsUsed + 1;
  return {
    turnsUsed,
    turnLimit: state.turnLimit,
    status: turnsUsed >= state.turnLimit ? "closed" : "open",
  };
}

/** 저장된 이력에서 위기 턴 수를 센다. MessageRow 의 crisis 만 본다 */
export function countCrisis(messages: { crisis: boolean }[]): number {
  return messages.reduce((n, m) => (m.crisis ? n + 1 : n), 0);
}
