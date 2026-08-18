import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { MATCH_SECTIONS } from "./sections";
import { decodeMatchSections, getMatchSections, putMatchSections } from "./store";

describe("decodeMatchSections", () => {
  const verdict = { headline: "가", summary: "나" };

  it("버전이 다른 행은 버린다 — 옛 스키마의 서술을 그대로 쓰면 안 된다", () => {
    const out = decodeMatchSections(
      [{ section_key: "verdict", content: verdict, schema_version: 0 }],
      ["verdict"],
    );
    expect(out.missing).toEqual(["verdict"]);
  });

  it("손상된 행도 '없는 섹션' 으로 만든다", () => {
    const out = decodeMatchSections(
      [{ section_key: "verdict", content: { headline: "" }, schema_version: MATCH_SECTIONS.verdict.version }],
      ["verdict"],
    );
    expect(out.missing).toEqual(["verdict"]);
  });

  it("모르는 키는 무시한다 — 지워진 섹션이다", () => {
    const out = decodeMatchSections(
      [{ section_key: "사라진섹션", content: {}, schema_version: 1 }],
      ["verdict"],
    );
    expect(out.have).toEqual({});
  });

  it("멀쩡한 행은 담는다", () => {
    const out = decodeMatchSections(
      [{ section_key: "verdict", content: verdict, schema_version: MATCH_SECTIONS.verdict.version }],
      ["verdict"],
    );
    expect(out.have.verdict).toEqual(verdict);
    expect(out.missing).toEqual([]);
  });
});

describe("쿼리", () => {
  it("빈 키 목록이면 DB 를 부르지 않는다", async () => {
    let called = false;
    const client = (() => { called = true; return Promise.resolve([]); }) as unknown as SqlClient;
    await getMatchSections("1", [], client);
    expect(called).toBe(false);
  });

  it("쓸 게 없으면 DB 를 부르지 않는다", async () => {
    let called = false;
    const client = (() => { called = true; return Promise.resolve([]); }) as unknown as SqlClient;
    await putMatchSections("1", {}, "m", client);
    expect(called).toBe(false);
  });

  it("저장은 버전이 다를 때만 덮어쓴다 — DO NOTHING 이면 캐시가 영원히 회복되지 않는다", async () => {
    const queries: string[] = [];
    const client = ((s: TemplateStringsArray, ...v: unknown[]) => {
      queries.push(s.join("?")); void v; return Promise.resolve([]);
    }) as unknown as SqlClient;
    await putMatchSections("1", { verdict: { headline: "가", summary: "나" } }, "m", client);
    expect(queries[0]).toContain("ON CONFLICT");
    expect(queries[0]).toContain("DO UPDATE");
  });
});
