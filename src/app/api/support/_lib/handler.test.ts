import { describe, expect, it, vi } from "vitest";
import type { PurchaseOption, ServiceOption } from "@/lib/support/types";
import { OTHER_OPTION } from "@/lib/support/types";
import {
  handleCreateSupportTicket,
  handleSupportOptions,
  type CreateSupportDeps,
  type SupportOptionsDeps,
} from "./handler";

const T = "2026-10-02T01:00:00.000Z";

const services: ServiceOption[] = [
  { target: { kind: "compatibility", ref: "5" }, title: "궁합", sub: "동진 × 민수", createdAt: T },
  OTHER_OPTION,
];

const purchases: PurchaseOption[] = [
  { purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원", createdAt: T, requested: false },
  { purchaseId: "10", paymentId: "saju-def", title: "이용권 1장", sub: "1,000원", createdAt: T, requested: true },
];

/** after() 대역 — 미룬 일을 모아 두었다가 테스트가 원할 때 돌린다. */
let deferred: (() => Promise<void>)[] = [];
const runDeferred = () => Promise.all(deferred.splice(0).map((t) => t()));

function deps(over: Partial<CreateSupportDeps> = {}) {
  deferred = [];
  const d: CreateSupportDeps = {
    defer: (task) => {
      deferred.push(task);
    },
    userId: "7",
    checkLimit: vi.fn(async () => true),
    getUser: vi.fn(async () => ({ displayName: "동진", email: "dj@example.com" })),
    listServiceOptions: vi.fn(async () => services),
    listPurchaseOptions: vi.fn(async () => purchases),
    insertTicket: vi.fn(async () => ({ id: "42", createdAt: T })),
    mailer: { send: vi.fn(async () => {}) },
    ...over,
  };
  return d;
}

describe("handleCreateSupportTicket", () => {
  it("비로그인은 401", async () => {
    const d = deps({ userId: null });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(401);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "nope", body: "x" }],
    [{ kind: "feedback", body: "   " }],
    [{ kind: "feedback", body: "x".repeat(4001) }],
    [{ kind: "error", target: { kind: "map", ref: "3" }, body: "" }],
    [{ kind: "error", target: { kind: "bogus", ref: "3" }, body: "x" }],
    [{ kind: "refund", purchaseId: "9", reason: "그냥요" }],
    [{ kind: "refund", purchaseId: "abc", reason: "기타" }],
  ])("형식이 틀리면 400: %j", async (raw) => {
    const d = deps();
    expect((await handleCreateSupportTicket(raw, d)).status).toBe(400);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429", async () => {
    const d = deps({ checkLimit: vi.fn(async () => false) });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(429);
  });

  it("피드백 — 저장하고 메일을 보내고 201", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "feedback", body: "  좋아요  " }, d);
    expect(r).toEqual({ status: 201, body: { id: "42" } });
    expect(d.insertTicket).toHaveBeenCalledWith({
      userId: "7", kind: "feedback", targetKind: null, targetRef: null, targetLabel: null,
      purchaseId: null, refundReason: null, body: "좋아요", replyEmail: "dj@example.com",
    });
    expect(d.mailer!.send).not.toHaveBeenCalled();
    await runDeferred();
    expect(d.mailer!.send).toHaveBeenCalledOnce();
  });

  it("메일이 끝나지 않아도 응답은 바로 나간다 — 발송은 응답 뒤로 미룬다", async () => {
    const d = deps({ mailer: { send: vi.fn(() => new Promise<void>(() => {})) } });
    const r = await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d);
    expect(r.status).toBe(201);
    expect(deferred).toHaveLength(1);
  });

  it("오류 문의 — 라벨은 서버가 목록에서 다시 만든다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket(
      { kind: "error", target: { kind: "compatibility", ref: "5" }, body: "안 열려요", label: "조작된 문구" },
      d,
    );
    expect(r.status).toBe(201);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ targetKind: "compatibility", targetRef: "5", targetLabel: "궁합 · 동진 × 민수" }),
    );
  });

  it("오류 문의 '기타' 는 목록을 읽지 않는다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "error", target: { kind: "other", ref: null }, body: "그 외" }, d);
    expect(r.status).toBe(201);
    expect(d.listServiceOptions).not.toHaveBeenCalled();
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ targetKind: "other", targetRef: null, targetLabel: "기타" }),
    );
  });

  it("내 목록에 없는 대상은 404 — 남의 id 다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "error", target: { kind: "compatibility", ref: "999" }, body: "x" }, d);
    expect(r.status).toBe(404);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("환불 — 결제 건 라벨과 사유를 저장한다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "refund", purchaseId: "9", reason: "실수로 결제했어요" }, d);
    expect(r.status).toBe(201);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "refund", purchaseId: "9", refundReason: "실수로 결제했어요",
        targetLabel: "이용권 6장 · 5,000원", body: "",
      }),
    );
  });

  it("내 결제가 아니면 404", async () => {
    const d = deps();
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "77", reason: "기타" }, d)).status).toBe(404);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("이미 열린 환불 요청이 있으면 409", async () => {
    const d = deps();
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "10", reason: "기타" }, d)).status).toBe(409);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("동시 요청이 앱 검사를 통과해도 INSERT 충돌이면 409, 메일은 안 보낸다", async () => {
    const d = deps({ insertTicket: vi.fn(async () => null) });
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "9", reason: "기타" }, d)).status).toBe(409);
    expect(d.mailer!.send).not.toHaveBeenCalled();
  });

  it("메일이 실패해도 201 — 저장이 원본이다", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ mailer: { send: vi.fn(async () => { throw new Error("resend down"); }) } });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(201);
    await runDeferred();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("메일러가 없으면(키 미설정) 건너뛰고 201", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps({ mailer: null });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(201);
    warn.mockRestore();
  });

  it("사용자 행이 없으면 401", async () => {
    const d = deps({ getUser: vi.fn(async () => null) });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(401);
  });
});

describe("handleSupportOptions", () => {
  function od(over: Partial<SupportOptionsDeps> = {}): SupportOptionsDeps {
    return {
      userId: "7",
      listServiceOptions: vi.fn(async () => services),
      listPurchaseOptions: vi.fn(async () => purchases),
      getBalance: vi.fn(async () => 3),
      ...over,
    };
  }

  it("비로그인 401", async () => {
    expect((await handleSupportOptions("error", od({ userId: null }))).status).toBe(401);
  });

  it("모르는 kind 는 400 — feedback 도 목록이 없다", async () => {
    expect((await handleSupportOptions("feedback", od())).status).toBe(400);
    expect((await handleSupportOptions(null, od())).status).toBe(400);
  });

  it("error 는 서비스 목록", async () => {
    expect(await handleSupportOptions("error", od())).toEqual({
      status: 200, body: { kind: "error", items: services },
    });
  });

  it("refund 는 결제 목록과 잔여 이용권", async () => {
    expect(await handleSupportOptions("refund", od())).toEqual({
      status: 200, body: { kind: "refund", items: purchases, balance: 3 },
    });
  });
});
