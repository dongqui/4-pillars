import { describe, expect, it, vi } from "vitest";
import type { FlowContext } from "./prompt";
import type { FlowGenerator } from "./generator";
import { chargeFlowGeneration, gateFlowGeneration, isFlowRateLimited } from "./gated-generator";
import { FlowRateLimitError } from "@/lib/flows/rate-limit";
import { FlowTicketsError } from "@/lib/flows/tickets";

const ctx = { segments: [{ id: "segment_1" }] } as unknown as FlowContext;

function stub(): FlowGenerator & { calls: number } {
  const g = {
    model: "test-model",
    calls: 0,
    async generateSections() {
      g.calls += 1;
      return {};
    },
  };
  return g as unknown as FlowGenerator & { calls: number };
}

describe("gateFlowGeneration", () => {
  it("한도에 걸리면 안쪽 생성기를 부르지 않는다 — 비용을 쓴 뒤 보고하면 게이트가 아니다", async () => {
    const inner = stub();
    const gated = gateFlowGeneration(inner, "3", async () => false);
    await expect(gated.generateSections(ctx, ["now"])).rejects.toBeInstanceOf(FlowRateLimitError);
    expect(inner.calls).toBe(0);
  });

  it("통과하면 그대로 흘려보낸다", async () => {
    const inner = stub();
    const gated = gateFlowGeneration(inner, "3", async () => true);
    await gated.generateSections(ctx, ["now"]);
    expect(inner.calls).toBe(1);
  });

  it("모델 식별자를 바꾸지 않는다 — DB 에 기록되는 값이다", () => {
    expect(gateFlowGeneration(stub(), "3", async () => true).model).toBe("test-model");
  });
});

describe("chargeFlowGeneration", () => {
  it("잔액이 모자라면 안쪽 생성기를 부르지 않는다", async () => {
    const inner = stub();
    const charged = chargeFlowGeneration(inner, "3", "7", async () => ({
      ok: false, kind: "insufficient", balance: 0,
    }));
    await expect(charged.generateSections(ctx, ["now"])).rejects.toBeInstanceOf(FlowTicketsError);
    expect(inner.calls).toBe(0);
  });

  it("subject_key 로 flowId 를 넘긴다 — 같은 해에 두 번 차감되지 않는 근거다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 4 }));
    await chargeFlowGeneration(stub(), "3", "7", spend).generateSections(ctx, ["now"]);
    expect(spend).toHaveBeenCalledWith({
      userId: "3", feature: "yearly_flow", subjectKey: "7",
    });
  });

  it("이미 권한이 있으면 다시 깎지 않고 통과한다", async () => {
    const inner = stub();
    await chargeFlowGeneration(inner, "3", "7", async () => ({
      ok: true, kind: "already", balance: 4,
    })).generateSections(ctx, ["now"]);
    expect(inner.calls).toBe(1);
  });
});

describe("isFlowRateLimited", () => {
  it("cause 에 싸인 것도 알아본다 — produce 가 감싸서 던진다", () => {
    expect(isFlowRateLimited(new Error("x", { cause: new FlowRateLimitError() }))).toBe(true);
    expect(isFlowRateLimited(new Error("x"))).toBe(false);
  });
});
