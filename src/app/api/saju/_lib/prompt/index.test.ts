import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { SECTION_KEYS } from "../sections";
import { buildSectionRequest, SECTION_TOOL_NAME } from "./index";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });

describe("buildSectionRequest", () => {
  it("모든 섹션에 대해 요청을 만든다", () => {
    for (const key of SECTION_KEYS) {
      const req = buildSectionRequest(analysis, key);
      expect(req.key, key).toBe(key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.toolName, key).toBe(SECTION_TOOL_NAME);
      expect(req.inputSchema.required, key).toEqual(["content"]);
    }
  });

  it("user 프롬프트에 사실 블록 · 지시문 · 문체 예시가 다 들어간다", () => {
    const req = buildSectionRequest(analysis, "strengths");
    expect(req.user).toContain("[사실 · 원국]");
    expect(req.user).toContain("[요청 · strengths]");
    expect(req.user).toContain("[문체 예시]");
  });

  it("요청에 대운·세운이 들어가지 않는다", () => {
    const req = buildSectionRequest(analysis, "overview");
    expect(req.user).not.toContain("[사실 · 대운]");
    expect(req.user).not.toContain("[사실 · 세운]");
  });
});
