import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { hasEntitlement, listEntitledSubjects } from "./entitlements";

function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(rows);
  }) as unknown as SqlClient;
  return { client, calls };
}

describe("hasEntitlement", () => {
  it("권한 행이 있으면 true", async () => {
    const { client } = fakeSql([{ id: 1 }]);
    expect(await hasEntitlement("3", "yearly_flow", "7", client)).toBe(true);
  });

  it("없으면 false", async () => {
    const { client } = fakeSql([]);
    expect(await hasEntitlement("3", "yearly_flow", "7", client)).toBe(false);
  });

  it("세 컬럼 모두로 거른다", async () => {
    const { client, calls } = fakeSql([]);
    await hasEntitlement("3", "yearly_flow", "7", client);
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].text).toContain("feature");
    expect(calls[0].text).toContain("subject_key");
    expect(calls[0].values).toEqual(["3", "yearly_flow", "7"]);
  });
});

describe("listEntitledSubjects", () => {
  it("subject_key 만 문자열로 뽑는다", async () => {
    const { client } = fakeSql([{ subject_key: "7" }, { subject_key: 9 }]);
    const out = await listEntitledSubjects("1", "yearly_flow", client);
    expect(out).toEqual(["7", "9"]);
  });

  it("없으면 빈 배열이다", async () => {
    const { client } = fakeSql([]);
    expect(await listEntitledSubjects("1", "yearly_flow", client)).toEqual([]);
  });

  // 위 두 테스트는 fakeSql 이 인자와 무관하게 같은 rows 를 돌려주므로 추출
  // 로직만 본다 — WHERE 절이 통째로 빠진 구현(다른 사용자의 권한까지 새는
  // 버전)에도 똑같이 통과한다. 여기서는 이 함수가 유료 접근의 핵심 경계라 —
  // 화면은 이 목록에 없는 연도만 이용권을 요구한다 — 쿼리가 실제로
  // user_id·feature 둘 다로 걸러지는지, 그 값이 문자열 이어붙이기가 아니라
  // 바인딩 파라미터로 들어가는지를 직접 본다.
  it("user_id 와 feature 둘 다로 거른다", async () => {
    const { client, calls } = fakeSql([]);
    await listEntitledSubjects("3", "yearly_flow", client);
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].text).toContain("feature");
    expect(calls[0].values).toEqual(["3", "yearly_flow"]);
  });
});
