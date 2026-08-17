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
 *
 * 이 파일은 두 함수를 나눠 내놓는다. 차감하는 쪽(checkMatchLimit)은 실제로 LLM 을
 * 부르는 자리에서만 부르고(app/api/matches/_lib/gated-generator.ts), 읽기만 하는 쪽
 * (peekMatchLimit)은 만들기 경로가 미리 안내하는 데 쓴다 — 두 자리에서 다 차감하면
 * 한 번의 생성이 두 번 세진다.
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

/**
 * 읽기 전용 클라이언트. incr 를 아예 넣지 않는다 — peekMatchLimit 이 실수로 차감하는
 * 코드를 타입이 막게 두는 것이 주석보다 강하다.
 */
export interface RateLimitReader {
  get(key: string): Promise<unknown>;
}

const defaultClient: RateLimitClient = redis;

const keyOf = (userId: string) => `match:user:${userId}`;

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
  const key = keyOf(userId);

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

/**
 * 다음 생성이 한도 안에 들어가는가 — **세지 않고** 본다.
 *
 * 경계가 `n < MATCH_HOURLY_LIMIT` 인 이유: 다음 생성은 카운터를 n+1 로 올리고
 * checkMatchLimit 은 `n+1 <= 한도` 로 판정한다. 여기서 `<=` 를 쓰면 마지막 한 장을
 * 남겨두고 미리 막는다.
 *
 * 실패는 checkMatchLimit 과 같은 방향으로 막는다(fail-closed). 판단 불가일 때 열어
 * 두면 실제 게이트도 어차피 막을 것이라 만들어 놓고 절대 채워지지 않는 궁합이 남는다.
 */
export async function peekMatchLimit(
  userId: string,
  client: RateLimitReader = redis,
): Promise<boolean> {
  let raw: unknown;
  try {
    raw = await client.get(keyOf(userId));
  } catch (err) {
    console.error(
      "[peekMatchLimit] Redis error, blocking creation:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  // 키가 없으면 이 시간 창에서 아직 아무것도 만들지 않았다는 뜻이다.
  if (raw === null || raw === undefined) return true;
  const n = Number(raw);
  // 값이 숫자로 안 읽히면 카운터를 신뢰할 수 없다 — 여기서도 막는 쪽으로 기운다.
  if (!Number.isFinite(n)) return false;
  return n < MATCH_HOURLY_LIMIT;
}
