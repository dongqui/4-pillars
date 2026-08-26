import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { findFlow, findOrCreateFlow, getFlow } from "./store";

const segments = [
  { id: "segment_1" as const, start: "2026-02-04T00:00:00.000Z", end: "2026-08-07T00:00:00.000Z", basis: "연시작" as const },
  { id: "segment_2" as const, start: "2026-08-07T00:00:00.000Z", end: "2027-02-04T00:00:00.000Z", basis: "월운전환" as const },
];

const row = {
  id: 7,
  user_id: 3,
  profile_id: 11,
  flow_year: 2026,
  period_start: new Date("2026-02-04T00:00:00.000Z"),
  period_end: new Date("2027-02-04T00:00:00.000Z"),
  segments,
  created_at: new Date("2026-03-01T00:00:00.000Z"),
};

/** 태그드 템플릿 호출을 받아 쿼리 문자열과 값을 기록하는 가짜 client. */
function fakeSql(results: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, calls };
}

describe("findFlow", () => {
  it("프로필과 연도로 찾는다", async () => {
    const { client, calls } = fakeSql([[row]]);
    const out = await findFlow("11", 2026, client);

    expect(calls[0].text).toContain("FROM flows");
    expect(calls[0].values).toEqual(["11", 2026]);
    expect(out?.id).toBe("7");
    expect(out?.flowYear).toBe(2026);
    expect(out?.segments).toHaveLength(2);
  });

  it("없으면 null", async () => {
    const { client } = fakeSql([[]]);
    expect(await findFlow("11", 2026, client)).toBeNull();
  });
});

describe("findOrCreateFlow", () => {
  it("새로 넣으면 created 다", async () => {
    const { client } = fakeSql([[{ id: 7 }]]);
    expect(await findOrCreateFlow("3", {
      profileId: "11", flowYear: 2026,
      periodStart: row.period_start, periodEnd: row.period_end, segments,
    }, client)).toEqual({ id: "7", created: true });
  });

  it("충돌하면 기존 행으로 수렴한다 — 이용권이 두 번 나가지 않는 근거다", async () => {
    const { client } = fakeSql([[], [{ id: 7 }]]);
    expect(await findOrCreateFlow("3", {
      profileId: "11", flowYear: 2026,
      periodStart: row.period_start, periodEnd: row.period_end, segments,
    }, client)).toEqual({ id: "7", created: false });
  });

  it("충돌했는데 되찾지도 못하면 던진다 — 조용히 null 을 흘리지 않는다", async () => {
    const { client } = fakeSql([[], []]);
    await expect(
      findOrCreateFlow("3", {
        profileId: "11", flowYear: 2026,
        periodStart: row.period_start, periodEnd: row.period_end, segments,
      }, client),
    ).rejects.toThrow(/되찾지 못했습니다/);
  });
});

describe("getFlow", () => {
  it("user_id 를 WHERE 에 건다 — id 는 순번이라 URL 로 남의 것을 읽을 수 있다", async () => {
    const { client, calls } = fakeSql([[row]]);
    await getFlow("3", "7", client);
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].values).toEqual(["7", "3"]);
  });
});
