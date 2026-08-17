import { checkMatchLimit } from "./rate-limit";

/**
 * 궁합을 만들 수 있는가.
 *
 * ⚠️ **이용권 게이트가 들어올 자리다.** 궁합은 이용권 1장(1,000원)짜리 상품으로
 * 정해져 있으나 이용권 시스템이 아직 없다. 잔액 확인과 차감이 생기면 이 함수만
 * 고친다 — 호출부는 { ok, reason } 만 읽는다.
 *
 * 차감은 "새로 만든 경우에만" 이어야 한다. findOrCreateMatch 가 created 를
 * 돌려주는 것이 그 판단을 위한 재료다.
 */
export type MatchAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" };

export interface MatchAccessDeps {
  checkLimit(userId: string): Promise<boolean>;
}

const defaultDeps: MatchAccessDeps = { checkLimit: (id) => checkMatchLimit(id) };

export async function canCreateMatch(
  userId: string | null,
  deps: MatchAccessDeps = defaultDeps,
): Promise<MatchAccess> {
  if (userId === null) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.checkLimit(userId))) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}
