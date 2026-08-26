import { redis } from "@/lib/redis";

/**
 * 지금의 흐름 생성 한도.
 *
 * 흐름은 리포트와 달리 프로필+해 조합마다 항상 LLM 을 부르는 것은 아니다 —
 * 이미 만든 프로필·해라면 flows_unique 로 기존 행에 수렴해 LLM 을 부르지 않는다.
 * 그래도 새 조합을 계속 시도하면 매번 LLM 을 부른다는 점은 궁합과 같다.
 *
 * 구조는 src/lib/matches/rate-limit.ts 와 같다(고정 윈도, incr + expire NX).
 * 키가 IP 가 아니라 userId 인 이유: 흐름은 로그인 필수라 계정이 이미 식별자이고,
 * 계정 생성 자체가 OAuth 를 거치는 더 비싼 관문이다.
 *
 * 이 파일은 두 함수를 나눠 내놓는다. 차감하는 쪽(checkFlowLimit)은 실제로 LLM 을
 * 부르는 자리에서만 부르고(app/api/flows/_lib/gated-generator.ts), 읽기만 하는 쪽
 * (peekFlowLimit)은 만들기 경로가 미리 안내하는 데 쓴다 — 두 자리에서 다 차감하면
 * 한 번의 생성이 두 번 세진다.
 *
 * 이용권이 붙은 뒤로 이 카운터는 매출을 제한하는 장치가 아니다 — 돈을 내고 쓰는
 * 사용자를 막을 이유가 없다. 남은 쓸모는 **돈이 걸리지 않은 경로**다:
 * ticket_entries.reason 의 grant(수기·프로모션 지급)로 이용권이 잘못 풀리거나,
 * 차감 게이트 자체에 버그가 생기면 막을 것이 없다.
 *
 * 그래서 숫자는 "정상 사용자를 세는" 값이 아니라 "사고만 걸리는" 값이다. 가장 큰
 * 충전 패키지가 13장이므로 한 번 충전한 사용자는 60 에 닿을 수 없다.
 *
 * 궁합의 같은 파일이 남긴 경고 하나가 여기도 적용된다: 이미 권한을 가진 사용자가
 * 실패한 생성을 반복 재시도하면(섹션이 끝내 다 저장되지 않는 흐름이거나, 대기 중
 * 조급하게 새로고침하는 경우) 시간당 최대 60 × 섹션 수만큼 LLM 호출까지 갈 수
 * 있다. 이 경로에는 여전히 DB 계층 상한이 없다.
 */
export const FLOW_HOURLY_LIMIT = 60;

const WINDOW_SECONDS = 60 * 60;

export class FlowRateLimitError extends Error {
  constructor() {
    super("지금의 흐름 생성 한도를 넘었습니다");
    this.name = "FlowRateLimitError";
  }
}

export interface RateLimitClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number, option?: "NX" | "XX" | "GT" | "LT"): Promise<unknown>;
}

/**
 * 읽기 전용 클라이언트. incr 를 아예 넣지 않는다 — peekFlowLimit 이 실수로 차감하는
 * 코드를 타입이 막게 두는 것이 주석보다 강하다.
 */
export interface RateLimitReader {
  get(key: string): Promise<unknown>;
}

const defaultClient: RateLimitClient = redis;

const keyOf = (userId: string) => `flow:user:${userId}`;

/**
 * 한도 안이면 true.
 *
 * **incr 실패는 막는다(fail-closed).** 판단 불가일 때 열어 두면 Redis 장애가
 * 그대로 무제한 LLM 호출이 된다 — 뒤에 DB 계층 상한이 없다.
 * expire 실패는 삼킨다: 이미 n 을 얻어 판단이 정해졌고, bookkeeping 이 그 판단을
 * 뒤집으면 안 된다.
 */
export async function checkFlowLimit(
  userId: string,
  client: RateLimitClient = defaultClient,
): Promise<boolean> {
  const key = keyOf(userId);

  let n: number;
  try {
    n = await client.incr(key);
  } catch (err) {
    console.error(
      "[checkFlowLimit] Redis error, blocking generation:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  try {
    await client.expire(key, WINDOW_SECONDS, "NX");
  } catch (err) {
    console.warn(
      "[checkFlowLimit] Expire error (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }

  return n <= FLOW_HOURLY_LIMIT;
}

/**
 * 다음 생성이 한도 안에 들어가는가 — **세지 않고** 본다.
 *
 * 경계가 `n < FLOW_HOURLY_LIMIT` 인 이유: 다음 생성은 카운터를 n+1 로 올리고
 * checkFlowLimit 은 `n+1 <= 한도` 로 판정한다. 여기서 `<=` 를 쓰면 마지막 한 장을
 * 남겨두고 미리 막는다.
 *
 * 실패는 checkFlowLimit 과 같은 방향으로 막는다(fail-closed). 판단 불가일 때 열어
 * 두면 실제 게이트도 어차피 막을 것이라 만들어 놓고 절대 채워지지 않는 흐름이 남는다.
 */
export async function peekFlowLimit(
  userId: string,
  client: RateLimitReader = redis,
): Promise<boolean> {
  let raw: unknown;
  try {
    raw = await client.get(keyOf(userId));
  } catch (err) {
    console.error(
      "[peekFlowLimit] Redis error, blocking creation:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  // 키가 없으면 이 시간 창에서 아직 아무것도 만들지 않았다는 뜻이다.
  if (raw === null || raw === undefined) return true;
  const n = Number(raw);
  // 값이 숫자로 안 읽히면 카운터를 신뢰할 수 없다 — 여기서도 막는 쪽으로 기운다.
  if (!Number.isFinite(n)) return false;
  return n < FLOW_HOURLY_LIMIT;
}
