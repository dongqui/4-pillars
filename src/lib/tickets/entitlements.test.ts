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

function fakeClient(rows: Record<string, unknown>[]) {
  return (() => Promise.resolve(rows)) as never;
}

describe("listEntitledSubjects", () => {
  it("subject_key 만 문자열로 뽑는다", async () => {
    const out = await listEntitledSubjects(
      "1",
      "yearly_flow",
      fakeClient([{ subject_key: "7" }, { subject_key: 9 }]),
    );
    expect(out).toEqual(["7", "9"]);
  });

  it("없으면 빈 배열이다", async () => {
    expect(await listEntitledSubjects("1", "yearly_flow", fakeClient([]))).toEqual([]);
  });
});
