import { describe, it, expect } from "vitest";
import { getCached, putCached, putSection, type SqlClient, type CacheRecord } from "./store";
import type { Interpretation } from "./types";

const interpretation: Interpretation = {
  ilgan: { title: "일간 갑", body: "본문" },
  strengths: ["강점"],
  weaknesses: ["약점"],
  relationships: { title: "인간관계", body: "본문" },
};

/** getCached가 조립할 섹션 행들 */
const sectionRows = [
  { section_key: "ilgan", content: interpretation.ilgan },
  { section_key: "strengths", content: interpretation.strengths },
  { section_key: "weaknesses", content: interpretation.weaknesses },
  { section_key: "relationships", content: interpretation.relationships },
];

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const record: CacheRecord = {
  chartKey: "경오|신사|정묘|을사|male",
  gender: "male",
  pillars: { year: "경오", month: "신사", day: "정묘", hour: "을사" },
  interpretation,
  model: "stub",
};

describe("getCached", () => {
  it("모든 섹션 행이 있으면 Interpretation으로 조립한다", async () => {
    const { client } = fakeClient(sectionRows);
    expect(await getCached("k", client)).toEqual(interpretation);
  });

  it("섹션이 일부만 있으면 null (불완전 캐시는 miss로 취급)", async () => {
    const { client } = fakeClient(sectionRows.slice(0, 2));
    expect(await getCached("k", client)).toBeNull();
  });

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getCached("k", client)).toBeNull();
  });

  it("섹션 테이블을 chart_key로 조회한다", async () => {
    const { client, calls } = fakeClient(sectionRows);
    await getCached("k", client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("FROM saju_interpretation_sections");
    expect(calls[0].values).toContain("k");
  });
});

describe("putCached", () => {
  it("부모 행을 ON CONFLICT DO NOTHING으로 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations");
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key) DO NOTHING");
    expect(calls[0].values).toContain(record.chartKey);
    expect(calls[0].values).toContain("stub");
  });

  it("해석을 최상위 키마다 한 섹션 행으로 펼쳐 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls).toHaveLength(2);
    expect(calls[1].sql).toContain("INSERT INTO saju_interpretation_sections");
    expect(calls[1].sql).toContain("jsonb_each");
    expect(calls[1].sql).toContain("ON CONFLICT (chart_key, section_key) DO NOTHING");
    expect(calls[1].values).toContain(JSON.stringify(interpretation));
  });

  it("부모 행을 섹션보다 먼저 넣는다 (FK 순서)", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations (");
    expect(calls[1].sql).toContain("INSERT INTO saju_interpretation_sections");
  });
});

describe("putSection", () => {
  it("단일 섹션을 덮어쓴다 (재생성용)", async () => {
    const { client, calls } = fakeClient([]);
    await putSection(
      { chartKey: record.chartKey, sectionKey: "ilgan", content: interpretation.ilgan, model: "llm-v2" },
      client,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretation_sections");
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key, section_key) DO UPDATE");
    expect(calls[0].values).toContain("ilgan");
    expect(calls[0].values).toContain("llm-v2");
    expect(calls[0].values).toContain(JSON.stringify(interpretation.ilgan));
  });
});
