import { describe, expect, it, vi } from "vitest";
import { MatchRateLimitError } from "@/lib/matches/rate-limit";
import { gateMatchGeneration, isMatchRateLimited } from "./gated-generator";
import { MatchGenerationError } from "./produce";
import type { MatchGenerator } from "./generator";
import type { MatchContext } from "./prompt";

const ctx = {} as MatchContext;

function innerGenerator(): MatchGenerator & { generateSections: ReturnType<typeof vi.fn> } {
  return {
    model: "deepseek-test",
    generateSections: vi.fn().mockResolvedValue({ verdict: { headline: "h", summary: "s" } }),
  };
}

describe("gateMatchGeneration", () => {
  it("한도 안이면 안쪽 생성기에 그대로 넘긴다", async () => {
    const inner = innerGenerator();
    const gated = gateMatchGeneration(inner, "7", async () => true);

    const out = await gated.generateSections(ctx, ["verdict", "chemistry"]);

    expect(out).toEqual({ verdict: { headline: "h", summary: "s" } });
    expect(inner.generateSections).toHaveBeenCalledWith(ctx, ["verdict", "chemistry"]);
  });

  it("한도를 넘으면 MatchRateLimitError 를 던진다", async () => {
    const gated = gateMatchGeneration(innerGenerator(), "7", async () => false);
    await expect(gated.generateSections(ctx, ["verdict"])).rejects.toBeInstanceOf(
      MatchRateLimitError,
    );
  });

  it("한도를 넘으면 안쪽 생성기를 부르지 않는다 — 게이트의 존재 이유가 이것이다", async () => {
    const inner = innerGenerator();
    const gated = gateMatchGeneration(inner, "7", async () => false);

    await expect(gated.generateSections(ctx, ["verdict"])).rejects.toThrow();

    expect(inner.generateSections).not.toHaveBeenCalled();
  });

  it("한도 판정에 넘긴 userId 를 쓴다 — 계정끼리 카운터가 섞이면 안 된다", async () => {
    const checkLimit = vi.fn().mockResolvedValue(true);
    await gateMatchGeneration(innerGenerator(), "42", checkLimit).generateSections(ctx, ["verdict"]);
    expect(checkLimit).toHaveBeenCalledWith("42");
  });

  it("model 은 안쪽 것을 그대로 쓴다 — DB 에 기록되는 값이다", () => {
    expect(gateMatchGeneration(innerGenerator(), "7", async () => true).model).toBe(
      "deepseek-test",
    );
  });
});

describe("isMatchRateLimited", () => {
  it("MatchGenerationError 로 감싸여도 알아본다 — produce 가 cause 에 넣는다", () => {
    const wrapped = new MatchGenerationError(new MatchRateLimitError(), {});
    expect(isMatchRateLimited(wrapped)).toBe(true);
  });

  it("생성 실패는 한도가 아니다 — 사용자에게 할 말이 다르다", () => {
    expect(isMatchRateLimited(new MatchGenerationError(new Error("500 from deepseek"), {}))).toBe(
      false,
    );
  });

  it("맨몸으로 던져진 것도 알아본다", () => {
    expect(isMatchRateLimited(new MatchRateLimitError())).toBe(true);
  });
});
