import { describe, it, expect } from "vitest";
import {
  getCached,
  decodeSections,
  putCached,
  putSection,
  putSections,
  toSectionWrites,
  type SqlClient,
  type CacheRecord,
  type SectionWrite,
} from "./store";
import { isSectionKey, sectionVersion, type SectionKey } from "./sections";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const keys: SectionKey[] = ["overview", "outerVsInner"];

// schema_version 기본값은 레지스트리에서 가져온다 — 여기 1 을 박아 두면
// 어떤 섹션의 version 이 올라갈 때마다 무관한 테스트가 무더기로 깨진다.
const row = (
  section_key: string,
  content: unknown,
  schema_version = isSectionKey(section_key) ? sectionVersion(section_key) : 1,
) => ({
  section_key,
  content,
  schema_version,
});

const trait = { title: "t", body: "b", basis: "근거" };
const overview = { headline: "h", summary: "s", traits: [trait, trait, trait, trait] };
const outerVsInner = { outward: "겉", inner: "속" };

const record: CacheRecord = {
  chartKey: "경오|신사|정묘|을사|male",
  gender: "male",
  pillars: { year: "경오", month: "신사", day: "정묘", hour: "을사" },
  interpretation: { overview, outerVsInner },
  model: "stub",
};

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

describe("toSectionWrites", () => {
  it("Partial<Interpretation> 을 쓰기 목록으로 편다", () => {
    expect(toSectionWrites({ overview, outerVsInner })).toEqual([
      { sectionKey: "overview", content: overview },
      { sectionKey: "outerVsInner", content: outerVsInner },
    ]);
  });

  it("undefined 인 섹션은 빠진다", () => {
    expect(toSectionWrites({ overview, wealth: undefined })).toEqual([
      { sectionKey: "overview", content: overview },
    ]);
  });
});

describe("putSections", () => {
  it("UNNEST 로 섹션마다 schema_version 을 함께 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putSections("k", toSectionWrites({ overview, outerVsInner }), "stub", client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretation_sections");
    expect(calls[0].sql).toContain("UNNEST");
    expect(calls[0].values).toContainEqual(["overview", "outerVsInner"]);
    expect(calls[0].values).toContainEqual([sectionVersion("overview"), sectionVersion("outerVsInner")]);
  });

  it("빈 목록이면 쿼리를 보내지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await putSections("k", [], "stub", client);
    expect(calls).toHaveLength(0);
  });

  it("schema_version 이 다른 옛 행은 덮어쓴다 (DO NOTHING 이면 영원히 재생성 루프에 빠진다)", async () => {
    // 진짜 DB가 있어야 WHERE 절이 실제로 갱신을 걸러내는지 끝까지 검증할 수 있다.
    // 여기 fake SqlClient 는 SQL 문자열만 받아 그대로 돌려주므로, 우리가 확인할 수 있는
    // 건 "쓰기 쿼리가 갱신형(conditional DO UPDATE) 인가" 까지다.
    const { client, calls } = fakeClient([]);
    await putSections("k", toSectionWrites({ overview }), "stub", client);
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key, section_key) DO UPDATE");
    expect(calls[0].sql).toContain("SET content = EXCLUDED.content");
    expect(calls[0].sql).toContain("schema_version = EXCLUDED.schema_version");
    // 같은 버전끼리는 갱신하지 않아 동시 요청의 선착순 결과가 유지된다 —
    // 그 보증이 이 WHERE 절에 있다.
    expect(calls[0].sql).toContain(
      "WHERE saju_interpretation_sections.schema_version <> EXCLUDED.schema_version",
    );
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

  it("부모 행을 섹션보다 먼저 넣는다 (FK 순서)", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations (");
    expect(calls[1].sql).toContain("INSERT INTO saju_interpretation_sections");
  });

  it("해석이 비어도 부모 행은 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putCached({ ...record, interpretation: {} }, client);
    expect(calls).toHaveLength(1);
  });
});

describe("putSection", () => {
  it("단일 섹션을 schema_version 과 함께 덮어쓴다 (재생성용)", async () => {
    const { client, calls } = fakeClient([]);
    await putSection(
      { chartKey: record.chartKey, sectionKey: "overview", content: overview, model: "llm-v2" },
      client,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key, section_key) DO UPDATE");
    expect(calls[0].sql).toContain("schema_version = EXCLUDED.schema_version");
    expect(calls[0].values).toContain("overview");
    expect(calls[0].values).toContain("llm-v2");
    expect(calls[0].values).toContain(JSON.stringify(overview));
    expect(calls[0].values).toContain(sectionVersion("overview"));
  });
});

describe("SectionWrite 타입", () => {
  it("잘못된 짝은 컴파일되지 않는다 (@ts-expect-error 가 지워지면 이 테스트가 깨진다)", () => {
    // @ts-expect-error personality 의 content 는 TitledText[] 이지 객체가 아니다
    const bad: SectionWrite = { sectionKey: "personality", content: { title: "t", body: "b" } };
    expect(bad).toBeDefined();
  });
});
