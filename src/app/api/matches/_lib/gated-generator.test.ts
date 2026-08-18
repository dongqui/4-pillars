import { describe, expect, it, vi } from "vitest";
import { MatchRateLimitError } from "@/lib/matches/rate-limit";
import { MatchTicketsError } from "@/lib/matches/tickets";
import {
  gateMatchGeneration,
  isMatchOutOfTickets,
  isMatchRateLimited,
  spendOnMatchGeneration,
} from "./gated-generator";
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

describe("spendOnMatchGeneration", () => {
  it("차감이 성사되면 안쪽 생성기를 부른다", async () => {
    const inner = innerGenerator();
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    const gated = spendOnMatchGeneration(inner, { userId: "7", matchId: "42", spend });

    await gated.generateSections(ctx, ["verdict"]);

    expect(spend).toHaveBeenCalledWith({
      userId: "7",
      feature: "compatibility",
      subjectKey: "42",
    });
    expect(inner.generateSections).toHaveBeenCalledTimes(1);
  });

  it("이미 차감된 궁합을 다시 열면 공짜다 — already 도 통과시킨다", async () => {
    const inner = innerGenerator();
    const gated = spendOnMatchGeneration(inner, {
      userId: "7",
      matchId: "42",
      spend: async () => ({ ok: true as const, kind: "already" as const, balance: 5 }),
    });

    await gated.generateSections(ctx, ["verdict"]);

    expect(inner.generateSections).toHaveBeenCalledTimes(1);
  });

  it("잔액이 없으면 던지고 안쪽 생성기를 부르지 않는다", async () => {
    const inner = innerGenerator();
    const gated = spendOnMatchGeneration(inner, {
      userId: "7",
      matchId: "42",
      spend: async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 }),
    });

    await expect(gated.generateSections(ctx, ["verdict"])).rejects.toBeInstanceOf(
      MatchTicketsError,
    );
    // 여기서 순서가 뒤집히면 게이트는 "비용을 막는 것"이 아니라 "비용을 쓴 뒤 보고하는 것"이 된다.
    expect(inner.generateSections).not.toHaveBeenCalled();
  });

  it("model 은 안쪽 것을 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다", () => {
    const inner = innerGenerator();
    const gated = spendOnMatchGeneration(inner, { userId: "7", matchId: "42", spend: vi.fn() });
    expect(gated.model).toBe(inner.model);
  });
});

describe("isMatchOutOfTickets", () => {
  it("직접 던진 것과 cause 에 감싸인 것을 둘 다 잡는다", () => {
    expect(isMatchOutOfTickets(new MatchTicketsError())).toBe(true);
    expect(
      isMatchOutOfTickets(new MatchGenerationError(new MatchTicketsError(), {})),
    ).toBe(true);
  });

  it("한도 초과와 섞이지 않는다", () => {
    expect(isMatchOutOfTickets(new MatchRateLimitError())).toBe(false);
    expect(isMatchRateLimited(new MatchTicketsError())).toBe(false);
  });
});
