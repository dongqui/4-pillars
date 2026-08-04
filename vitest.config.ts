import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      // db.ts가 import 시점에 DATABASE_URL을 요구. 테스트는 가짜 client를 주입하므로 실제 연결 안 함.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      // redis.ts도 같은 이유. 마찬가지로 실제 호출은 목으로 막는다.
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  },
});
