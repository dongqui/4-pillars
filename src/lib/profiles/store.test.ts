import { describe, it, expect } from "vitest";
import {
  CounterpartLimitError,
  MAX_COUNTERPARTS,
  MAX_PROFILES,
  ProfileLimitError,
  countProfiles,
  createProfile,
  getProfile,
  listProfiles,
  promoteProfileToSelf,
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
  kind: "self",
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
      kind: "self",
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
    // 'all' — 이 테스트는 kind 필터링이 아니라 isPaid 파생을 본다.
    const rows = await listProfiles("7", "all", client);

    expect(rows).toHaveLength(1);
    expect(rows[0].isPaid).toBe(true);
    expect(calls[0].sql).toContain("LEFT JOIN purchases");
    expect(calls[0].sql).toContain("ORDER BY p.created_at DESC");
    // 바인딩 순서는 템플릿에 나타난 순서다 — product 가 JOIN 조건이라 user_id 보다 앞선다.
    expect(calls[0].values).toEqual(["full_report", "7"]);
  });

  it("프로필이 없으면 빈 배열", async () => {
    const { client } = fakeClient([]);
    expect(await listProfiles("7", "all", client)).toEqual([]);
  });
});

describe("countProfiles", () => {
  it("count 결과를 숫자로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 2 }]);
    expect(await countProfiles("7", "self", client)).toBe(2);
    expect(calls[0].sql).toContain("FROM profiles");
    // WHERE user_id 가 빠지면 전체 유저의 프로필을 세게 되어 개수 한도가
    // 계정별이 아니라 전역이 되어버린다 — 그 회귀를 여기서 잡는다.
    expect(calls[0].sql).toContain("WHERE user_id");
    expect(calls[0].values).toEqual(["7", "self"]);
  });
});

describe("createProfile", () => {
  it("한도 미만이면 INSERT 하고 id 를 문자열로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 1 }], [{ id: 42 }]);
    expect(await createProfile("7", newProfile, client)).toEqual({ id: "42" });

    expect(calls[1].sql).toContain("INSERT INTO profiles");
    // 15개 위치 바인딩 전부를 컬럼 순서대로 고정한다 — toContain(null)처럼 위치를
    // 안 가리면 birth_hour/birth_country 같은 컬럼이 뒤바뀌어도 테스트가 안 잡는다.
    // 순서는 store.ts의 INSERT 컬럼 목록과 동일하다:
    // user_id, name, gender, calendar, is_leap_month,
    // birth_year, birth_month, birth_day,
    // time_known, birth_hour, birth_minute,
    // birth_country, birth_region_id, true_solar, kind
    expect(calls[1].values).toEqual([
      "7",
      "이정숙",
      "female",
      "lunar",
      true,
      1963,
      4,
      12,
      false,
      null,
      null,
      null,
      null,
      true,
      "self",
    ]);
  });

  it("한도에 도달하면 ProfileLimitError 를 던지고 INSERT 하지 않는다", async () => {
    const { client, calls } = fakeClient([{ n: MAX_PROFILES }]);
    await expect(createProfile("7", newProfile, client)).rejects.toBeInstanceOf(ProfileLimitError);
    expect(calls).toHaveLength(1);
  });

  // 궁합 상대는 내 사주 한도와 따로 센다. 세지 않고 두면 한 계정이 영구 행을 끝없이 쌓는다.
  it("궁합 상대는 'other' 카운터만 본다 — 내 사주 20개와 섞이지 않는다", async () => {
    const { client, calls } = fakeClient([{ n: 30 }], [{ id: 42 }]);
    await createProfile("7", { ...newProfile, kind: "other" }, client);

    expect(calls[0].values).toEqual(["7", "other"]);
    // 30 은 MAX_PROFILES 를 넘지만 MAX_COUNTERPARTS 안이라 그대로 들어간다.
    expect(calls[1].sql).toContain("INSERT INTO profiles");
  });

  it("궁합 상대 상한에 도달하면 CounterpartLimitError 를 던지고 INSERT 하지 않는다", async () => {
    const { client, calls } = fakeClient([{ n: MAX_COUNTERPARTS }]);
    await expect(
      createProfile("7", { ...newProfile, kind: "other" }, client),
    ).rejects.toBeInstanceOf(CounterpartLimitError);
    expect(calls).toHaveLength(1);
  });

  it("내 사주는 'other' 가 몇이든 자기 카운터만 본다", async () => {
    const { client, calls } = fakeClient([{ n: 1 }], [{ id: 42 }]);
    await createProfile("7", newProfile, client);
    expect(calls[0].values).toEqual(["7", "self"]);
  });
});

describe("getProfile", () => {
  it("행이 있으면 ProfileRow 로 접는다", async () => {
    const { client, calls } = fakeClient([{ ...dbRow, is_paid: true }]);
    const row = await getProfile("7", "3", client);

    expect(row?.id).toBe("3");
    expect(row?.isPaid).toBe(true);
    expect(calls[0].sql).toContain("LEFT JOIN purchases");
  });

  // id 만으로 찾으면 쿼리 파라미터를 증가시켜 남의 생년월일을 읽을 수 있다.
  // 이 회귀를 여기서 잡는다.
  it("user_id 를 함께 필터한다", async () => {
    const { client, calls } = fakeClient([]);
    await getProfile("7", "3", client);

    expect(calls[0].sql).toContain("p.user_id");
    // 바인딩 순서는 템플릿에 나타난 순서다 — product(JOIN 조건) → id → user_id.
    expect(calls[0].values).toEqual(["full_report", "3", "7"]);
  });

  it("행이 없으면 null — 없는 프로필과 남의 프로필을 구분하지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await getProfile("7", "3", client)).toBeNull();
  });
});

describe("kind", () => {
  it("listProfiles 는 kind 로 거른다 — 'self' 는 궁합 상대를 홈에 올리지 않는다", async () => {
    const queries: string[] = [];
    const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(strings.join("?"));
      void values;
      return Promise.resolve([]);
    }) as unknown as SqlClient;

    await listProfiles("1", "self", client);
    expect(queries[0]).toContain("p.kind =");
  });

  it("listProfiles('all') 은 거르지 않는다 — 궁합 상대 선택 목록이 쓴다", async () => {
    const queries: string[] = [];
    const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(strings.join("?"));
      void values;
      return Promise.resolve([]);
    }) as unknown as SqlClient;

    await listProfiles("1", "all", client);
    expect(queries[0]).not.toContain("p.kind =");
  });

  it("toProfileRow 는 모르는 kind 를 'self' 로 접지 않는다 — 'other' 를 지켜야 홈이 안 샌다", () => {
    const row = toProfileRow({
      id: 1, name: "테스트", gender: "male", calendar: "solar", is_leap_month: false,
      birth_year: 1990, birth_month: 1, birth_day: 1, time_known: false,
      true_solar: true, created_at: "2026-01-01", kind: "other",
    });
    expect(row.kind).toBe("other");
  });

  it("promoteProfileToSelf 는 이미 self 면 false 를 낸다", async () => {
    const client = (() => Promise.resolve([])) as unknown as SqlClient;
    expect(await promoteProfileToSelf("1", "2", client)).toBe(false);
  });

  // user_id 조건이 없으면 남의 궁합 상대를 내 사주 목록으로 끌어올 수 있다 —
  // getMatch 의 같은 회귀 테스트(src/lib/matches/store.test.ts)와 같은 자리다.
  it("promoteProfileToSelf 는 user_id 를 함께 필터한다", async () => {
    const { client, calls } = fakeClient([{ id: 2 }]);
    expect(await promoteProfileToSelf("1", "2", client)).toBe(true);

    expect(calls[0].sql).toContain("user_id =");
    // 'other' 만 올린다 — 이미 self 인 행을 건드려 봤자 할 일이 없다.
    expect(calls[0].sql).toContain("kind = 'other'");
    // 바인딩 순서는 템플릿에 나타난 순서다 — id → user_id.
    expect(calls[0].values).toEqual(["2", "1"]);
  });
});
