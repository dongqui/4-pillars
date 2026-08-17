import { redis } from "@/lib/redis";

/**
 * 궁합 생성 한도.
 *
 * 궁합은 리포트와 달리 **항상** LLM 을 부른다 — 결과가 match_id 에 묶여 있어
 * 사람 사이에 재사용되는 캐시가 없다. 이용권 게이트가 붙기 전까지 이 카운터가
 * 유일한 방어선이다.
 *
 * 구조는 src/lib/reports/rate-limit.ts 와 같다(고정 윈도, incr + expire NX).
 * 키가 IP 가 아니라 userId 인 이유: 궁합은 로그인 필수라 계정이 이미 식별자이고,
 * 계정 생성 자체가 OAuth 를 거치는 더 비싼 관문이다.
 */
export const MATCH_HOURLY_LIMIT = 5;

const WINDOW_SECONDS = 60 * 60;

export class MatchRateLimitError extends Error {
  constructor() {
    super("궁합 생성 한도를 넘었습니다");
    this.name = "MatchRateLimitError";
  }
}

export interface RateLimitClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number, option?: "NX" | "XX" | "GT" | "LT"): Promise<unknown>;
}

const defaultClient: RateLimitClient = redis;

/**
 * 한도 안이면 true.
 *
 * **incr 실패는 막는다(fail-closed).** 판단 불가일 때 열어 두면 Redis 장애가
 * 그대로 무제한 LLM 호출이 된다 — 뒤에 DB 계층 상한이 없다.
 * expire 실패는 삼킨다: 이미 n 을 얻어 판단이 정해졌고, bookkeeping 이 그 판단을
 * 뒤집으면 안 된다.
 */
export async function checkMatchLimit(
  userId: string,
  client: RateLimitClient = defaultClient,
): Promise<boolean> {
  const key = `match:user:${userId}`;

  let n: number;
  try {
    n = await client.incr(key);
  } catch (err) {
    console.error(
      "[checkMatchLimit] Redis error, blocking generation:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  try {
    await client.expire(key, WINDOW_SECONDS, "NX");
  } catch (err) {
    console.warn(
      "[checkMatchLimit] Expire error (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }

  return n <= MATCH_HOURLY_LIMIT;
}
