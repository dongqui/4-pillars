import { describe, it, expect } from "vitest";
import { getLuckCached, putLuckSections } from "./store-luck";
import type { SqlClient } from "./store";
import type { SectionKey } from "./sections";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const keys: SectionKey[] = ["yearlyLuck"];
const yearlyLuck = [{ title: "t", desc: "d" }];

describe("getLuckCached", () => {
  it("saju_luck_sections 를 luck_key 로 조회한다", async () => {
    const { client, calls } = fakeClient([]);
    await getLuckCached("lk", keys, client);
    expect(calls[0].sql).toContain("FROM saju_luck_sections");
    expect(calls[0].sql).toContain("luck_key");
    expect(calls[0].values).toContain("lk");
  });

  it("chart 캐시와 같은 규칙으로 have/missing 을 가른다", async () => {
    const { client } = fakeClient([
      { section_key: "yearlyLuck", content: yearlyLuck, schema_version: 1 },
    ]);
    expect(await getLuckCached("lk", keys, client)).toEqual({
      have: { yearlyLuck },
      missing: [],
    });
  });

  it("schema_version 이 다르면 missing", async () => {
    const { client } = fakeClient([
      { section_key: "yearlyLuck", content: yearlyLuck, schema_version: 99 },
    ]);
    expect((await getLuckCached("lk", keys, client)).missing).toEqual(["yearlyLuck"]);
  });
});

describe("putLuckSections", () => {
  it("UNNEST 로 넣고 기존 값을 갱신한다 (대운은 해마다 다시 뽑힌다)", async () => {
    const { client, calls } = fakeClient([]);
    await putLuckSections("lk", [{ sectionKey: "yearlyLuck", content: yearlyLuck }], "stub", client);
    expect(calls[0].sql).toContain("INSERT INTO saju_luck_sections");
    expect(calls[0].sql).toContain("UNNEST");
    expect(calls[0].sql).toContain("ON CONFLICT (luck_key, section_key) DO UPDATE");
    expect(calls[0].values).toContainEqual(["yearlyLuck"]);
  });

  it("빈 목록이면 쿼리를 보내지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await putLuckSections("lk", [], "stub", client);
    expect(calls).toHaveLength(0);
  });
});
