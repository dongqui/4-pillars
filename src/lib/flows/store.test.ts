import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { findFlow, findOrCreateFlow, getFlow, listFlowYears } from "./store";

const months = [
  { index: 1, start: "2026-02-04T00:00:00.000Z", end: "2026-03-05T00:00:00.000Z", korean: "경인", pivot: false },
  { index: 2, start: "2026-03-05T00:00:00.000Z", end: "2026-04-04T00:00:00.000Z", korean: "신묘", pivot: true },
];

const row = {
  id: 7,
  user_id: 3,
  profile_id: 11,
  flow_year: 2026,
  period_start: new Date("2026-02-04T00:00:00.000Z"),
  period_end: new Date("2027-02-04T00:00:00.000Z"),
  months,
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
    expect(out?.months).toHaveLength(2);
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
      periodStart: row.period_start, periodEnd: row.period_end, months,
    }, client)).toEqual({ id: "7", created: true });
  });

  it("충돌하면 기존 행으로 수렴한다 — 이용권이 두 번 나가지 않는 근거다", async () => {
    const { client } = fakeSql([[], [{ id: 7 }]]);
    expect(await findOrCreateFlow("3", {
      profileId: "11", flowYear: 2026,
      periodStart: row.period_start, periodEnd: row.period_end, months,
    }, client)).toEqual({ id: "7", created: false });
  });

  it("충돌했는데 되찾지도 못하면 던진다 — 조용히 null 을 흘리지 않는다", async () => {
    const { client } = fakeSql([[], []]);
    await expect(
      findOrCreateFlow("3", {
        profileId: "11", flowYear: 2026,
        periodStart: row.period_start, periodEnd: row.period_end, months,
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

describe("listFlowYears", () => {
  it("user_id·profile_id 로 거르고 최신 연도순으로 정렬한다", async () => {
    const { client, calls } = fakeSql([[{ id: 7, flow_year: 2026 }]]);
    const out = await listFlowYears("3", "11", client);

    expect(calls[0].text).toContain("user_id");
    expect(calls[0].text).toContain("profile_id");
    expect(calls[0].text).toContain("ORDER BY flow_year DESC");
    expect(calls[0].values).toEqual(["3", "11"]);
    expect(out).toEqual([{ id: "7", flowYear: 2026 }]);
  });
});

// months 는 jsonb 컬럼이다. Neon HTTP 드라이버가 이미 파싱된 배열을 주는
// 경우와 JSON 문자열 그대로 주는 경우가 둘 다 있어 findFlow(→toFlowRow) 가
// 양쪽을 다 받아내는지, 그리고 모양이 아예 다를 때는 조용히 흘리지 않고
// 던지는지를 고정한다.
describe("findFlow — months(jsonb) 읽기", () => {
  it("드라이버가 이미 파싱한 배열로 주면 그대로 읽는다", async () => {
    const { client } = fakeSql([[{ ...row, months }]]);
    const out = await findFlow("11", 2026, client);
    expect(out?.months).toEqual(months);
  });

  it("드라이버가 JSON 문자열로 줘도 배열로 읽는다 — 파싱된 경우와 결과가 같다", async () => {
    const { client } = fakeSql([[{ ...row, months: JSON.stringify(months) }]]);
    const out = await findFlow("11", 2026, client);
    expect(out?.months).toEqual(months);
  });

  it("배열도 JSON 도 아니면 던진다 — 글자 수를 달 개수로 흘리지 않는다", async () => {
    const { client } = fakeSql([[{ ...row, months: "이것은 json 이 아니다" }]]);
    await expect(findFlow("11", 2026, client)).rejects.toThrow(/months/);
  });

  it("빈 배열이면 던진다 — 달이 0개인 흐름은 깨진 행이다", async () => {
    const { client } = fakeSql([[{ ...row, months: [] }]]);
    await expect(findFlow("11", 2026, client)).rejects.toThrow(/months/);
  });
});

describe("toFlowRow — months", () => {
  it("드라이버가 jsonb 를 문자열로 줘도 파싱한다", async () => {
    const oneMonth = [{ index: 1, start: "a", end: "b", korean: "임인", pivot: false }];
    const { client } = fakeSql([[{
      id: 2, user_id: 1, profile_id: 3, flow_year: 2027,
      period_start: "2027-02-04T00:00:00Z", period_end: "2028-02-04T00:00:00Z",
      months: JSON.stringify(oneMonth), created_at: "2026-08-27T00:00:00Z",
    }]]);
    const row = await getFlow("1", "2", client);
    expect(row?.months).toEqual(oneMonth);
  });

  it("months 가 배열이 아니면 던진다", async () => {
    // 빈 배열로 접으면 12칸짜리 화면이 0칸으로 조용히 깨지고 원인이 묻힌다
    const { client } = fakeSql([[{
      id: 2, user_id: 1, profile_id: 3, flow_year: 2027,
      period_start: "2027-02-04T00:00:00Z", period_end: "2028-02-04T00:00:00Z",
      months: "not json", created_at: "2026-08-27T00:00:00Z",
    }]]);
    await expect(getFlow("1", "2", client)).rejects.toThrow();
  });
});
