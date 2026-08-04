import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN is not set. .env.local 을 확인한다.",
  );
}

/**
 * Upstash Redis (REST 드라이버).
 *
 * db.ts 와 같은 이유로 모듈 로드 시점에 환경 변수를 확인한다 — 요청 중에
 * 조용히 실패하면 어떤 입력이 사라졌는지 알 길이 없다.
 */
export const redis = Redis.fromEnv();
