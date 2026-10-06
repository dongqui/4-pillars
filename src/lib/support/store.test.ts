import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { OTHER_OPTION } from "./types";
import {
  OPTION_LIMIT,
  insertSupportTicket,
  listPurchaseOptions,
  listServiceOptions,
  toPurchaseOption,
  toServiceOption,
} from "./store";

function recorder(results: Record<string, unknown>[][]) {
  const queries: string[] = [];
  const params: unknown[][] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push(strings.join("?"));
    params.push(values);
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, queries, params };
}

const T = "2026-10-01T03:00:00.000Z";

describe("toServiceOption", () => {
  it("리포트는 프로필 이름", () => {
    expect(
      toServiceOption({ feature: "full_report", subject_key: "12", created_at: T, profile_name: "엄마" }),
    ).toEqual({ target: { kind: "full_report", ref: "12" }, title: "리포트", sub: "엄마", createdAt: T });
  });

  it("궁합은 두 사람 이름", () => {
    const o = toServiceOption({
      feature: "compatibility", subject_key: "5", created_at: T,
      subject_name: "동진", counterpart_name: "민수",
    });
    expect(o?.title).toBe("궁합");
    expect(o?.sub).toBe("동진 × 민수");
  });

  it("상담은 제목, 제목이 없으면 '제목 없는 상담'", () => {
    expect(
      toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: 8, consult_title: "이직 고민" })?.sub,
    ).toBe("이직 고민");
    expect(
      toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: 8, consult_title: null })?.sub,
    ).toBe("제목 없는 상담");
  });

  it("한 해의 흐름은 연도를 제목에", () => {
    const o = toServiceOption({
      feature: "yearly_flow", subject_key: "3", created_at: T, flow_year: 2026, flow_profile_name: "동진",
    });
    expect(o?.title).toBe("2026 한 해의 흐름");
    expect(o?.sub).toBe("동진");
  });

  it("조인 대상이 지워졌으면 '삭제된 항목' — 목록을 깨지 않는다", () => {
    expect(toServiceOption({ feature: "full_report", subject_key: "12", created_at: T, profile_name: null })?.sub).toBe("삭제된 항목");
    expect(toServiceOption({ feature: "compatibility", subject_key: "5", created_at: T, subject_name: null, counterpart_name: null })?.sub).toBe("삭제된 항목");
    expect(toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: null, consult_title: null })?.sub).toBe("삭제된 항목");
    const flow = toServiceOption({ feature: "yearly_flow", subject_key: "3", created_at: T, flow_year: null, flow_profile_name: null });
    expect(flow?.title).toBe("한 해의 흐름");
    expect(flow?.sub).toBe("삭제된 항목");
  });

  it("모르는 feature 는 버린다", () => {
    expect(toServiceOption({ feature: "something_new", subject_key: "1", created_at: T })).toBeNull();
  });

  it("Date 로 온 created_at 도 ISO 문자열로 접는다", () => {
    const o = toServiceOption({ feature: "full_report", subject_key: "1", created_at: new Date(T), profile_name: "나" });
    expect(o?.createdAt).toBe(T);
  });
});

describe("listServiceOptions", () => {
  it("이용권 기록과 관계 지도를 최신순으로 섞고 '기타' 를 끝에 붙인다", async () => {
    const { client, params } = recorder([
      [
        { feature: "full_report", subject_key: "12", created_at: "2026-09-24T00:00:00.000Z", profile_name: "엄마" },
        { feature: "yearly_flow", subject_key: "3", created_at: "2026-10-02T00:00:00.000Z", flow_year: 2026, flow_profile_name: "동진" },
      ],
      [{ id: 4, center_name: "동진", created_at: "2026-09-28T00:00:00.000Z" }],
    ]);
    const list = await listServiceOptions("7", client);
    expect(list.map((o) => o.title)).toEqual(["2026 한 해의 흐름", "관계 지도", "리포트", "기타"]);
    expect(list[1].target).toEqual({ kind: "map", ref: "4" });
    expect(list.at(-1)).toEqual(OTHER_OPTION);
    expect(params[0]).toContain("7");
    expect(params[1]).toContain("7");
  });

  it("OPTION_LIMIT 개로 자른 뒤 '기타' 를 붙인다", async () => {
    const rows = Array.from({ length: OPTION_LIMIT + 5 }, (_, i) => ({
      feature: "full_report", subject_key: String(i), created_at: T, profile_name: "나",
    }));
    const { client } = recorder([rows, []]);
    const list = await listServiceOptions("7", client);
    expect(list).toHaveLength(OPTION_LIMIT + 1);
    expect(list.at(-1)).toEqual(OTHER_OPTION);
  });
});

describe("toPurchaseOption", () => {
  it("적립 장수·금액에 남은 장수와 환불액을 더한다 — 6장 5,000원에서 2장 쓰면 3,000원", () => {
    expect(
      toPurchaseOption({
        id: 9, payment_id: "saju-abc", product: "t5", amount: 5000, tickets: 6, remaining: 4,
        paid_at: T, created_at: "2026-09-30T00:00:00.000Z",
      }),
    ).toEqual({
      purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원",
      remaining: 4, refundAmount: 3000, createdAt: T,
    });
  });

  it("tickets 가 비어 있는 옛 행은 패키지 표에서 장수를 얻는다 — 표시용이다", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "t10", amount: 10000, tickets: null, remaining: 13,
      paid_at: null, created_at: T,
    });
    expect(o.title).toBe("이용권 13장");
    expect(o.createdAt).toBe(T);
  });

  it("모르는 상품이면 장수 없이 '이용권'", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "legacy", amount: 1000, tickets: null, remaining: 1,
      paid_at: T, created_at: T,
    });
    expect(o.title).toBe("이용권");
  });
});

describe("listPurchaseOptions", () => {
  const NOW = new Date("2026-10-02T09:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;
  const row = (over: Record<string, unknown>) => ({
    id: 9, payment_id: "p", product: "t5", amount: 5000, tickets: 6, remaining: 4, status: "paid",
    paid_at: new Date(NOW.getTime() - DAY).toISOString(), created_at: T, ...over,
  });

  it("paid · remaining > 0 · 7일 이내를 SQL 에서 거른다", async () => {
    const { client, queries, params } = recorder([[]]);
    await listPurchaseOptions("7", client, NOW);
    expect(queries[0]).toContain("status = 'paid'");
    expect(queries[0]).toContain("remaining > 0");
    expect(queries[0]).toContain("paid_at >= ?");
    expect(params[0]).toContain("7");
    expect(params[0]).toContainEqual(new Date(NOW.getTime() - 7 * DAY));
  });

  // 남은 장수는 있어도 쓴 장수를 정가로 치면 0 원인 결제가 있다 — SQL 이 모르는 규칙이라 앱에서 거른다.
  it("환불액이 0 인 건은 빼고 돌려준다", async () => {
    const { client } = recorder([[row({ id: 1, amount: 10000, tickets: 13, remaining: 3 }), row({ id: 2 })]]);
    const items = await listPurchaseOptions("7", client, NOW);
    expect(items.map((i) => i.purchaseId)).toEqual(["2"]);
  });

  it("tickets 가 NULL 인 옛 행은 뺀다 — 장수를 확신할 수 없는 결제는 환불하지 않는다", async () => {
    const { client } = recorder([[row({ id: 1, tickets: null, remaining: 1 })]]);
    expect(await listPurchaseOptions("7", client, NOW)).toEqual([]);
  });
});

describe("insertSupportTicket", () => {
  const base = {
    userId: "7", kind: "refund" as const, targetKind: null, targetRef: null,
    targetLabel: "이용권 6장 · 5,000원", purchaseId: "9", refundReason: "기타" as const,
    body: "", replyEmail: "a@b.c",
  };

  it("새 행의 id 를 돌려준다", async () => {
    const { client, queries } = recorder([[{ id: 1, created_at: T }]]);
    expect(await insertSupportTicket(base, client)).toEqual({ id: "1", createdAt: T });
    expect(queries[0]).toContain("ON CONFLICT DO NOTHING");
  });

  it("열린 환불 요청과 부딪혀 아무것도 안 돌아오면 null", async () => {
    const { client } = recorder([[]]);
    expect(await insertSupportTicket(base, client)).toBeNull();
  });

  it("status 를 안 주면 open, resolved 면 resolved_at 도 같이 찍는다", async () => {
    const { client, queries, params } = recorder([[{ id: 1, created_at: T }]]);
    await insertSupportTicket({ ...base, status: "resolved", adminNote: "자동 환불 3,000원" }, client);
    expect(queries[0]).toContain("resolved_at");
    expect(params[0]).toContain("resolved");
    expect(params[0]).toContain("자동 환불 3,000원");
  });
});
