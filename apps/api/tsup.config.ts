import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // 내부 워크스페이스 패키지는 TS 소스이므로 번들에 인라인한다.
  noExternal: [/@4-pillars\//],
});
