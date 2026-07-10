import { describe, it, expect } from "vitest";
import { getCached, putCached, type SqlClient, type CacheRecord } from "./store";
import type { Interpretation } from "./types";

const interpretation: Interpretation = {
  ilgan: { title: "일간 갑", body: "본문" },
  strengths: ["강점"],
  weaknesses: ["약점"],
  relationships: { title: "인간관계", body: "본문" },
};

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

describe("getCached", () => {
  it("행이 있으면 interpretation을 반환한다", async () => {
    const { client } = fakeClient([{ interpretation }]);
    expect(await getCached("k", client)).toEqual(interpretation);
  });

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getCached("k", client)).toBeNull();
  });
});

describe("putCached", () => {
  it("ON CONFLICT DO NOTHING INSERT를 실행한다", async () => {
    const { client, calls } = fakeClient([]);
    const record: CacheRecord = {
      chartKey: "경오|신사|정묘|을사|male",
      gender: "male",
      pillars: { year: "경오", month: "신사", day: "정묘", hour: "을사" },
      interpretation,
      model: "stub",
    };
    await putCached(record, client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations");
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key) DO NOTHING");
    expect(calls[0].values).toContain("경오|신사|정묘|을사|male");
    expect(calls[0].values).toContain("stub");
    expect(calls[0].values).toContain(JSON.stringify(record.interpretation));
  });
});
