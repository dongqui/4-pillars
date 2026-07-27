import { describe, it, expect } from "vitest";
import { getCached, decodeSections, type SqlClient } from "./store";
import type { SectionKey } from "./sections";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const keys: SectionKey[] = ["overview", "outerVsInner"];

const row = (section_key: string, content: unknown, schema_version = 1) => ({
  section_key,
  content,
  schema_version,
});

const overview = { headline: "h", summary: "s", keywords: ["a", "b", "c"] };
const outerVsInner = { outward: "겉", inner: "속" };

describe("getCached", () => {
  it("요청한 섹션이 다 있으면 have 에 담고 missing 은 빈다", async () => {
    const { client } = fakeClient([
      row("overview", overview),
      row("outerVsInner", outerVsInner),
    ]);
    expect(await getCached("k", keys, client)).toEqual({
      have: { overview, outerVsInner },
      missing: [],
    });
  });

  it("없는 섹션은 missing 으로 (일부만 재생성하려고)", async () => {
    const { client } = fakeClient([row("overview", overview)]);
    const res = await getCached("k", keys, client);
    expect(res.have).toEqual({ overview });
    expect(res.missing).toEqual(["outerVsInner"]);
  });

  it("schema_version 이 다르면 없는 것으로 취급한다", async () => {
    const { client } = fakeClient([row("overview", overview, 99)]);
    const res = await getCached("k", ["overview"], client);
    expect(res.have).toEqual({});
    expect(res.missing).toEqual(["overview"]);
  });

  it("스키마 검증에 실패한 행도 없는 것으로 취급한다 (손상된 캐시)", async () => {
    const { client } = fakeClient([row("overview", { headline: "h" })]);
    const res = await getCached("k", ["overview"], client);
    expect(res.missing).toEqual(["overview"]);
  });

  it("요청하지 않은 섹션 행은 무시한다", async () => {
    const { client } = fakeClient([row("overview", overview), row("wealth", {})]);
    const res = await getCached("k", ["overview"], client);
    expect(Object.keys(res.have)).toEqual(["overview"]);
  });

  it("행이 없으면 전부 missing", async () => {
    const { client } = fakeClient([]);
    expect(await getCached("k", keys, client)).toEqual({ have: {}, missing: keys });
  });

  it("섹션 테이블을 chart_key + 키 목록으로 조회한다", async () => {
    const { client, calls } = fakeClient([]);
    await getCached("k", keys, client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("FROM saju_interpretation_sections");
    expect(calls[0].values).toContain("k");
    expect(calls[0].values).toContainEqual(keys);
  });
});

describe("decodeSections", () => {
  it("행 배열을 have/missing 으로 가른다 (테이블과 무관한 순수 함수)", () => {
    expect(decodeSections([row("overview", overview)], keys)).toEqual({
      have: { overview },
      missing: ["outerVsInner"],
    });
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
