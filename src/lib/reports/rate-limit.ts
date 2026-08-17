import { redis } from "@/lib/redis";

/**
 * 비로그인 리포트 생성 방어.
 *
 * 무료 리포트가 실데이터로 열리면서 계정 없이도 LLM 생성을 유발할 수 있게 됐다.
 * 해석 캐시는 원국 단위라 같은 사주는 한 번뿐이지만, 생년월일을 바꿔가며
 * 드래프트를 새로 만들면 상한이 없다.
 *
 * 구조는 `src/lib/maps/rate-limit.ts`(익명 지도 참여)와 같다 — 고정 윈도 카운터를
 * incr + expire NX 두 번으로 끝낸다. 두 파일이 각자 사는 이유는 실패 처리가
 * 반대이기 때문이다(아래 참고). 합칠 거면 checkCounter·extractClientIp 만 합친다.
 */
export const ANON_REPORT_LIMIT = 10;

const WINDOW_SECONDS = 60 * 60;

/** 한도에 걸렸을 때 던진다. 생성 실패와 구분해서 다른 문구를 보여주려는 것이다. */
export class ReportRateLimitError extends Error {
  constructor() {
    super("익명 리포트 생성 한도를 넘었습니다");
    this.name = "ReportRateLimitError";
  }
}

export interface RateLimitClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number, option?: "NX" | "XX" | "GT" | "LT"): Promise<unknown>;
}

const defaultClient: RateLimitClient = redis;

/**
 * IP 별 한도. 한도 안이면 true.
 *
 * **incr 실패는 막는다(fail-closed).** 지도 쪽은 판단 불가일 때 열어 두는데, 그쪽에는
 * DB 계층 상한(MAX_ENTRIES·MAX_MAPS)이라는 최후 방어선이 있고 여기에는 없다 —
 * 열어 두면 Redis 장애가 곧바로 무제한 LLM 호출이 된다.
 *
 * 이 선택이 가용성을 깎지 않는 이유: 익명 리포트는 드래프트를 읽어야 서는데
 * 드래프트도 같은 Redis 에 있다. Redis 가 죽으면 이 경로는 어차피 서지 않는다.
 *
 * expire 실패는 삼킨다. 이미 n 을 얻어 판단이 정해졌고, bookkeeping 이 그 판단을
 * 뒤집으면 안 된다.
 */
export async function checkAnonReportLimit(
  ip: string,
  client: RateLimitClient = defaultClient,
): Promise<boolean> {
  const key = `report:anon:${ip}`;

  let n: number;
  try {
    n = await client.incr(key);
  } catch (err) {
    console.error(
      "[checkAnonReportLimit] Redis error, blocking generation:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  try {
    await client.expire(key, WINDOW_SECONDS, "NX");
  } catch (err) {
    console.warn(
      "[checkAnonReportLimit] Expire error (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }

  return n <= ANON_REPORT_LIMIT;
}

/**
 * 요청 헤더에서 클라이언트 IP 를 뽑는다.
 *
 * x-forwarded-for 의 오른쪽(마지막) 세그먼트를 쓴다. 프록시는 체인을 거칠 때마다
 * 자신이 관측한 주소를 오른쪽에 덧붙이므로(client, proxy1, proxy2, …) 왼쪽 끝은
 * 호출자가 아무 값이나 실어 보낼 수 있는 위조 가능한 자리다 — 왼쪽을 쓰면 헤더를
 * 바꿔가며 카운터를 매번 새로 시작시킬 수 있다.
 */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const segments = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 0) return segments[segments.length - 1];
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
