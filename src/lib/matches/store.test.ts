import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { MATCH_LIST_LIMIT, findOrCreateMatch, getMatch, listMatches, toMatchRow } from "./store";

const NONE = { type: null, subjectRole: null, counterpartRole: null } as const;

function recorder(results: Record<string, unknown>[][]) {
  const queries: string[] = [];
  const params: unknown[][] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push(strings.join("?"));
    params.push(values);
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, queries, params };
}

describe("toMatchRow", () => {
  it("빈 문자열을 null 로 접는다 — DB 의 '' 는 '없음' 이다", () => {
    const row = toMatchRow({
      id: 7, user_id: 1, subject_profile_id: 2, counterpart_profile_id: 3,
      relation_type: "", subject_role: "", counterpart_role: "",
      created_at: "2026-08-17",
    });
    expect(row.relation).toEqual(NONE);
  });

  it("모르는 relation_type 은 null 로 접는다 — 목록에서 지워진 유형이다", () => {
    const row = toMatchRow({
      id: 7, user_id: 1, subject_profile_id: 2, counterpart_profile_id: 3,
      relation_type: "사라진유형", subject_role: "", counterpart_role: "",
      created_at: "2026-08-17",
    });
    expect(row.relation.type).toBeNull();
  });

  it("bigint 는 문자열로 접는다", () => {
    // BigInt 리터럴(9007199254740993n) 은 이 저장소의 tsconfig target(ES2017) 에서
    // 컴파일되지 않는다 — 문자열로 만든 BigInt 로 같은 값을 구성한다.
    const row = toMatchRow({
      id: BigInt("9007199254740993"), user_id: 1, subject_profile_id: 2, counterpart_profile_id: 3,
      relation_type: "lover", subject_role: "", counterpart_role: "",
      created_at: "2026-08-17",
    });
    expect(row.id).toBe("9007199254740993");
    expect(row.relation.type).toBe("lover");
  });
});

describe("findOrCreateMatch", () => {
  it("새로 만들면 created 가 true 다", async () => {
    const { client } = recorder([[{ id: 42 }]]);
    const result = await findOrCreateMatch("1", {
      subjectProfileId: "2", counterpartProfileId: "3", relation: NONE,
    }, client);
    expect(result).toEqual({ id: "42", created: true });
  });

  it("이미 있으면 INSERT 가 아무것도 못 돌려주고, SELECT 로 같은 행에 수렴한다", async () => {
    const { client, queries } = recorder([[], [{ id: 42 }]]);
    const result = await findOrCreateMatch("1", {
      subjectProfileId: "2", counterpartProfileId: "3", relation: NONE,
    }, client);
    expect(result).toEqual({ id: "42", created: false });
    expect(queries[0]).toContain("ON CONFLICT");
    expect(queries[1]).toContain("SELECT id");
  });

  it("null 역할은 '' 로 내려간다 — 유니크 인덱스가 NULL 을 서로 다르게 본다", async () => {
    const { client, params } = recorder([[{ id: 1 }]]);
    await findOrCreateMatch("1", {
      subjectProfileId: "2", counterpartProfileId: "3", relation: NONE,
    }, client);
    expect(params[0]).toContain("");
    expect(params[0]).not.toContain(null);
  });

  it("경쟁에서 져 SELECT 도 비면 던진다 — 조용히 null 을 흘리지 않는다", async () => {
    const { client } = recorder([[], []]);
    await expect(
      findOrCreateMatch("1", { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE }, client),
    ).rejects.toThrow();
  });
});

describe("getMatch", () => {
  it("user_id 조건이 쿼리에 있다 — 없으면 id 를 증가시켜 남의 궁합을 읽는다", async () => {
    const { client, queries } = recorder([[]]);
    await getMatch("1", "42", client);
    expect(queries[0]).toContain("user_id =");
  });

  it("없으면 null", async () => {
    const { client } = recorder([[]]);
    expect(await getMatch("1", "42", client)).toBeNull();
  });
});

describe("listMatches", () => {
  it("두 프로필을 조인해 이름까지 한 번에 읽는다 — 행마다 조회하지 않는다", async () => {
    const { client, queries } = recorder([
      [
        {
          id: 7, subject_name: "곽희경", counterpart_name: "백상현",
          relation_type: "lover", subject_role: "", counterpart_role: "",
          created_at: "2026-08-18T00:00:00.000Z",
        },
      ],
    ]);
    const rows = await listMatches("1", client);

    expect(queries).toHaveLength(1);
    expect(rows).toEqual([
      {
        id: "7",
        subjectName: "곽희경",
        counterpartName: "백상현",
        relation: { type: "lover", subjectRole: null, counterpartRole: null },
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    ]);
  });

  // user_id 가 없으면 남의 궁합이 내 목록에 뜬다 — getMatch 와 같은 자리다.
  it("user_id 로 거르고 최신순으로 읽는다", async () => {
    const { client, queries, params } = recorder([[]]);
    await listMatches("42", client);

    expect(queries[0]).toContain("m.user_id =");
    expect(queries[0]).toContain("ORDER BY m.created_at DESC");
    expect(params[0]).toEqual(["42", MATCH_LIST_LIMIT]);
  });

  // 'temp' 상대와 본 궁합도 목록에는 남아야 한다 — kind 는 "다시 고를 후보로
  // 내놓지 않는다" 는 뜻이지 "없던 일" 이 아니다.
  it("상대의 kind 를 보지 않는다", async () => {
    const { client, queries } = recorder([[]]);
    await listMatches("1", client);
    expect(queries[0]).not.toContain("kind");
  });

  it("모르는 relation_type 은 null 로 접는다 — 목록 한 줄 때문에 화면이 깨지지 않는다", async () => {
    const { client } = recorder([
      [
        {
          id: 7, subject_name: "가", counterpart_name: "나",
          relation_type: "사라진유형", subject_role: "", counterpart_role: "",
          created_at: "2026-08-18T00:00:00.000Z",
        },
      ],
    ]);
    const rows = await listMatches("1", client);
    expect(rows[0].relation.type).toBeNull();
  });
});
