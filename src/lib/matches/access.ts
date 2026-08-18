import { getBalance } from "@/lib/tickets/wallet";
import { FEATURE_COST } from "@/lib/tickets/features";
import { peekMatchLimit } from "./rate-limit";

/**
 * 궁합을 만들 수 있는가.
 *
 * 이용권 게이트가 들어왔다. 궁합은 이용권 1장짜리 상품이고, 여기는 잔액을
 * **확인만** 한다 — 차감은 하지 않는다.
 *
 * **여기서는 세지도, 깎지도 않는다(읽기만 한다).** 실제로 LLM 을 부르는 자리는
 * /match/[id] 의 생성이고, 한도 카운터와 이용권 차감 모두 거기서 이뤄진다
 * (app/api/matches/_lib/gated-generator.ts). 만들기에서 같이 차감하면 같은
 * 쌍·같은 관계를 다시 제출해 matches_unique 로 기존 행에 수렴하는 요청 — LLM 을
 * 한 번도 부르지 않는 요청 — 이 한도와 이용권을 함께 먹는다.
 *
 * 그래서 이 함수는 "지금 만들면 볼 수 있는가" 를 미리 알려 주는 자리로 남는다.
 * 채워지지 않을 궁합 행을 만들어 두고 결과 화면에서야 한도나 잔액 부족을 알리는
 * 것보다 낫다. 잔액 확인은 여기서, 차감은 생성하는 자리에서.
 */
export type MatchAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" | "insufficient_tickets" };

export interface MatchAccessDeps {
  /** 세지 않고 보는 쪽만 주입한다 — 이름이 곧 계약이다 */
  peekLimit(userId: string): Promise<boolean>;
  /** 잔액도 읽기만 한다. 차감은 생성기 자리(gated-generator.ts)에서 한다 */
  getBalance(userId: string): Promise<number>;
}

const defaultDeps: MatchAccessDeps = {
  peekLimit: (id) => peekMatchLimit(id),
  getBalance: (id) => getBalance(id),
};

export async function canCreateMatch(
  userId: string | null,
  deps: MatchAccessDeps = defaultDeps,
): Promise<MatchAccess> {
  if (userId === null) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.peekLimit(userId))) return { ok: false, reason: "rate_limited" };
  // 한도 뒤에 두는 이유: 한도 확인은 Redis 한 번이고 잔액은 DB 한 번이라 싼 쪽이 먼저다.
  // 한도가 사고용 숫자로 올라간 뒤로 rate_limited 가 먼저 걸릴 일은 사실상 없다.
  if ((await deps.getBalance(userId)) < FEATURE_COST.compatibility) {
    return { ok: false, reason: "insufficient_tickets" };
  }
  return { ok: true };
}
