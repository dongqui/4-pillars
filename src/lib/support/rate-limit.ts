import { redis } from "@/lib/redis";
import type { RateLimitClient } from "@/lib/reports/rate-limit";

/**
 * 문의 연타 방어: 사용자당 10분에 5건.
 *
 * 구조는 reports/rate-limit.ts 와 같다(고정 윈도 incr + expire NX). 실패 처리는 반대다 —
 * **incr 실패는 열어 둔다(fail-open).** 문의는 LLM 호출처럼 비용이 새는 경로가 아니고,
 * Redis 장애 때 "오류 문의" 까지 막히면 사용자가 장애를 알릴 길이 없어진다.
 * 로그인 사용자만 오므로 열어 둬도 남용 범위가 계정 단위로 묶인다.
 */
export const SUPPORT_LIMIT = 5;

const WINDOW_SECONDS = 10 * 60;

export async function checkSupportLimit(
  userId: string,
  client: RateLimitClient = redis,
): Promise<boolean> {
  const key = `support:user:${userId}`;
  let n: number;
  try {
    n = await client.incr(key);
  } catch (err) {
    console.error("[checkSupportLimit] Redis error, allowing:", err instanceof Error ? err.message : err);
    return true;
  }
  try {
    await client.expire(key, WINDOW_SECONDS, "NX");
  } catch (err) {
    console.warn("[checkSupportLimit] Expire error (non-fatal):", err instanceof Error ? err.message : err);
  }
  return n <= SUPPORT_LIMIT;
}
