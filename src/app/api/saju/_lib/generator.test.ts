import { describe, it, expect } from "vitest";
import { createGenerator, MODEL } from "./generator";

describe("createGenerator", () => {
  // 키가 없을 때 조용히 stub 으로 흘러가면 자리표시자 문구가 그대로 사용자에게 나간다.
  it("키가 없으면 어떤 변수가 비었는지 밝히며 깨진다", () => {
    expect(() => createGenerator({})).toThrow(/DEEP_SEEK_API_KEY/);
  });

  // 이 값이 DB 의 model 컬럼에 그대로 박힌다. 바꾸면 기존 행과 섞이므로 못박아 둔다.
  it("model 은 deepseek-v4-pro", () => {
    expect(createGenerator({ DEEP_SEEK_API_KEY: "sk-x" }).model).toBe("deepseek-v4-pro");
    expect(MODEL).toBe("deepseek-v4-pro");
  });

  // 조립만 해야 한다 — 여기서 네트워크를 타면 부팅이 외부 API 에 묶인다.
  it("생성 없이 조립만 한다", () => {
    expect(typeof createGenerator({ DEEP_SEEK_API_KEY: "sk-x" }).generateSections).toBe(
      "function",
    );
  });
});
