import { describe, it, expect, vi } from "vitest";
import { handleSpend, type SpendDeps } from "./handler";

function deps(over: Partial<SpendDeps> = {}): SpendDeps {
  return {
    userId: "7",
    ownsSubject: vi.fn(async () => true),
    spend: vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 })),
    ...over,
  };
}

const body = { feature: "full_report", subjectKey: "3" };

describe("handleSpend", () => {
  it("차감되면 200 과 잔액", async () => {
    expect(await handleSpend(body, deps())).toEqual({
      status: 200,
      body: { kind: "spent", balance: 5 },
    });
  });

  it("이미 열려 있으면 200 — 실패가 아니라 원하던 결과다", async () => {
    const r = await handleSpend(
      body,
      deps({ spend: vi.fn(async () => ({ ok: true as const, kind: "already" as const, balance: 5 })) }),
    );
    expect(r).toEqual({ status: 200, body: { kind: "already", balance: 5 } });
  });

  it("잔액이 모자라면 402 — 화면이 이 코드를 보고 충전으로 보낸다", async () => {
    const r = await handleSpend(
      body,
      deps({
        spend: vi.fn(async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 })),
      }),
    );
    expect(r).toEqual({ status: 402, body: { kind: "insufficient", balance: 0 } });
  });

  it("로그인하지 않았으면 401", async () => {
    expect((await handleSpend(body, deps({ userId: null }))).status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [
      null,
      {},
      { feature: "full_report" },
      { feature: "unknown_service", subjectKey: "3" },
      { feature: "full_report", subjectKey: "" },
    ]) {
      expect((await handleSpend(bad, d)).status).toBe(400);
    }
  });

  it("남의 대상이면 404 — 없는 대상과 구분하지 않는다", async () => {
    const r = await handleSpend(body, deps({ ownsSubject: vi.fn(async () => false) }));
    expect(r.status).toBe(404);
  });

  it("소유하지 않았으면 차감을 시도하지도 않는다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    await handleSpend(body, deps({ spend, ownsSubject: vi.fn(async () => false) }));
    expect(spend).not.toHaveBeenCalled();
  });

  it("요청에 cost 를 실어도 무시된다 — 단가는 spendTicket 이 FEATURE_COST 에서 직접 읽는다", async () => {
    const spend = vi
      .fn<SpendDeps["spend"]>()
      .mockResolvedValue({ ok: true as const, kind: "spent" as const, balance: 5 });
    await handleSpend({ ...body, cost: 0 }, deps({ spend }));
    const call = spend.mock.calls[0][0];
    expect(call).toEqual({ userId: "7", feature: "full_report", subjectKey: "3" });
    expect(call).not.toHaveProperty("cost");
  });
});
