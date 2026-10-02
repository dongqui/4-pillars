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
  it("적립 장수(보너스 포함)와 금액을 적는다 — 카드 명세서의 주문명과 같다", () => {
    expect(
      toPurchaseOption({
        id: 9, payment_id: "saju-abc", product: "t5", amount: 5000, tickets: 6,
        paid_at: T, created_at: "2026-09-30T00:00:00.000Z", requested: false,
      }),
    ).toEqual({
      purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원", createdAt: T, requested: false,
    });
  });

  it("tickets 가 비어 있는 옛 행은 패키지 표에서 장수를 얻는다", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "t10", amount: 10000, tickets: null,
      paid_at: null, created_at: T, requested: true,
    });
    expect(o.title).toBe("이용권 13장");
    expect(o.createdAt).toBe(T);
    expect(o.requested).toBe(true);
  });

  it("모르는 상품이면 장수 없이 '이용권'", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "legacy", amount: 1000, tickets: null,
      paid_at: T, created_at: T, requested: false,
    });
    expect(o.title).toBe("이용권");
  });
});

describe("listPurchaseOptions", () => {
  it("이 사용자의 paid 건만 묻는다", async () => {
    const { client, queries, params } = recorder([[]]);
    await listPurchaseOptions("7", client);
    expect(queries[0]).toContain("status = 'paid'");
    expect(params[0]).toContain("7");
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
});
