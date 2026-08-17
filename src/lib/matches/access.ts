import { peekMatchLimit } from "./rate-limit";

/**
 * 궁합을 만들 수 있는가.
 *
 * ⚠️ **이용권 게이트가 들어올 자리다.** 궁합은 이용권 1장(1,000원)짜리 상품으로
 * 정해져 있으나 이용권 시스템이 아직 없다. 잔액 확인과 차감이 생기면 이 함수만
 * 고친다 — 호출부는 { ok, reason } 만 읽는다.
 *
 * **여기서는 세지 않는다(읽기만 한다).** 실제로 LLM 을 부르는 자리는 /match/[id] 의
 * 생성이고, 카운터는 거기서 깎인다(app/api/matches/_lib/gated-generator.ts). 만들기에서
 * 같이 차감하면 같은 쌍·같은 관계를 다시 제출해 matches_unique 로 기존 행에 수렴하는
 * 요청 — LLM 을 한 번도 부르지 않는 요청 — 이 한도를 1 먹는다.
 *
 * 그래서 이 함수는 "지금 만들면 볼 수 있는가" 를 미리 알려 주는 자리로 남는다.
 * 채워지지 않을 궁합 행을 만들어 두고 결과 화면에서야 한도를 알리는 것보다 낫다.
 * 이용권이 붙어도 같은 모양이다: 잔액 확인은 여기서, 차감은 생성하는 자리에서.
 */
export type MatchAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" };

export interface MatchAccessDeps {
  /** 세지 않고 보는 쪽만 주입한다 — 이름이 곧 계약이다 */
  peekLimit(userId: string): Promise<boolean>;
}

const defaultDeps: MatchAccessDeps = { peekLimit: (id) => peekMatchLimit(id) };

export async function canCreateMatch(
  userId: string | null,
  deps: MatchAccessDeps = defaultDeps,
): Promise<MatchAccess> {
  if (userId === null) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.peekLimit(userId))) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}
