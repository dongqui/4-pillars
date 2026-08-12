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
    // .claude/worktrees 는 gitignore 된 스크래치다. 거기 있는 워크트리 사본까지
    // 훑으면 남의 브랜치 테스트가 우리 수트에 섞이는데, `@` 별칭이 루트 src 로
    // 고정돼 있어 그 사본은 자기 소스가 아니라 이 저장소 본체를 상대로 돈다 —
    // 남의 브랜치가 빨간 것도, 우리 것이 빨간 것도 아닌 결과가 나온다.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/**"],
    env: {
      // db.ts가 import 시점에 DATABASE_URL을 요구. 테스트는 가짜 client를 주입하므로 실제 연결 안 함.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      // redis.ts도 같은 이유. 마찬가지로 실제 호출은 목으로 막는다.
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  },
});
