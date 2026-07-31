import { describe, it, expect } from "vitest";
import {
  MAX_PROFILES,
  ProfileLimitError,
  countProfiles,
  createProfile,
  listProfiles,
  toProfileRow,
  type CreateProfileInput,
  type SqlClient,
} from "./store";

/** 호출된 SQL과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const dbRow = {
  id: 3,
  name: "김동진",
  gender: "male",
  calendar: "solar",
  is_leap_month: false,
  birth_year: 1990,
  birth_month: 10,
  birth_day: 25,
  time_known: true,
  birth_hour: 15,
  birth_minute: 20,
  birth_country: "KR",
  birth_region_id: "seoul",
  true_solar: true,
  created_at: "2026-07-31T00:00:00.000Z",
  is_paid: false,
};

const newProfile: CreateProfileInput = {
  name: "이정숙",
  gender: "female",
  calendar: "lunar",
  isLeapMonth: true,
  birth: { year: 1963, month: 4, day: 12 },
  timeKnown: false,
  time: null,
  birthPlace: null,
  trueSolar: true,
};

describe("toProfileRow", () => {
  it("스네이크 케이스 컬럼을 뷰가 쓰는 모양으로 접는다", () => {
    expect(toProfileRow(dbRow)).toEqual({
      id: "3",
      name: "김동진",
      gender: "male",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1990, month: 10, day: 25 },
      timeKnown: true,
      time: { hour: 15, minute: 20 },
      birthPlace: { country: "KR", regionId: "seoul" },
      trueSolar: true,
      createdAt: "2026-07-31T00:00:00.000Z",
      isPaid: false,
    });
  });

  it("time_known 이 false 면 시각 컬럼이 남아 있어도 time 은 null", () => {
    const row = toProfileRow({ ...dbRow, time_known: false });
    expect(row.timeKnown).toBe(false);
    expect(row.time).toBeNull();
  });

  it("출생지를 건너뛴 행은 birthPlace 가 null", () => {
    const row = toProfileRow({ ...dbRow, birth_country: null, birth_region_id: null });
    expect(row.birthPlace).toBeNull();
  });
});

describe("listProfiles", () => {
  it("결제된 상품이 조인되면 isPaid 가 true", async () => {
    const { client, calls } = fakeClient([{ ...dbRow, is_paid: true }]);
    const rows = await listProfiles("7", client);

    expect(rows).toHaveLength(1);
    expect(rows[0].isPaid).toBe(true);
    expect(calls[0].sql).toContain("LEFT JOIN purchases");
    expect(calls[0].sql).toContain("ORDER BY p.created_at DESC");
    // 바인딩 순서는 템플릿에 나타난 순서다 — product 가 JOIN 조건이라 user_id 보다 앞선다.
    expect(calls[0].values).toEqual(["full_report", "7"]);
  });

  it("프로필이 없으면 빈 배열", async () => {
    const { client } = fakeClient([]);
    expect(await listProfiles("7", client)).toEqual([]);
  });
});

describe("countProfiles", () => {
  it("count 결과를 숫자로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 2 }]);
    expect(await countProfiles("7", client)).toBe(2);
    expect(calls[0].sql).toContain("FROM profiles");
  });
});

describe("createProfile", () => {
  it("한도 미만이면 INSERT 하고 id 를 문자열로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 1 }], [{ id: 42 }]);
    expect(await createProfile("7", newProfile, client)).toEqual({ id: "42" });

    expect(calls[1].sql).toContain("INSERT INTO profiles");
    // 시간을 모르는 프로필은 시각 컬럼이 null 로 들어간다
    expect(calls[1].values).toContain(null);
    expect(calls[1].values[1]).toBe("이정숙");
  });

  it("한도에 도달하면 ProfileLimitError 를 던지고 INSERT 하지 않는다", async () => {
    const { client, calls } = fakeClient([{ n: MAX_PROFILES }]);
    await expect(createProfile("7", newProfile, client)).rejects.toBeInstanceOf(ProfileLimitError);
    expect(calls).toHaveLength(1);
  });
});
