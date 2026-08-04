import { sql as neonSql } from "@/lib/db";
import { PRODUCT_FULL_REPORT } from "./products";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

/** 한 계정이 저장할 수 있는 프로필 수. 화면 문구와 같이 움직인다. */
export const MAX_PROFILES = 20;

export class ProfileLimitError extends Error {
  constructor() {
    super(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있습니다`);
    this.name = "ProfileLimitError";
  }
}

export interface ProfileRow {
  id: string;
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birth: { year: number; month: number; day: number };
  timeKnown: boolean;
  /** timeKnown 이 false 면 항상 null */
  time: { hour: number; minute: number } | null;
  /** 출생지를 건너뛰면 null (국가 기본 경도를 쓴다) */
  birthPlace: { country: string; regionId: string } | null;
  trueSolar: boolean;
  createdAt: string;
  /** purchases 조인에서 파생. 결제 미구현이라 현재는 항상 false. */
  isPaid: boolean;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isPaid">;

/**
 * DB 행 → ProfileRow. 컬럼 이름을 아는 유일한 곳이다.
 * time_known 이 false 면 시각 컬럼이 남아 있어도 버린다 — 두 필드가 어긋난 값을
 * 화면까지 흘려보내지 않는다.
 */
export function toProfileRow(r: Record<string, unknown>): ProfileRow {
  const timeKnown = r.time_known === true;
  const hour = r.birth_hour;
  const minute = r.birth_minute;
  const country = r.birth_country;
  const regionId = r.birth_region_id;

  return {
    id: String(r.id),
    name: String(r.name),
    gender: r.gender === "female" ? "female" : "male",
    calendar: r.calendar === "lunar" ? "lunar" : "solar",
    isLeapMonth: r.is_leap_month === true,
    birth: {
      year: Number(r.birth_year),
      month: Number(r.birth_month),
      day: Number(r.birth_day),
    },
    timeKnown,
    time:
      timeKnown && typeof hour === "number" && typeof minute === "number"
        ? { hour, minute }
        : null,
    birthPlace:
      typeof country === "string" && typeof regionId === "string"
        ? { country, regionId }
        : null,
    trueSolar: r.true_solar === true,
    createdAt: String(r.created_at),
    isPaid: r.is_paid === true,
  };
}

/**
 * 내 프로필을 최신순으로. 결제 여부는 purchases 를 LEFT JOIN 해 파생한다 —
 * profiles 에 is_paid 를 두면 결제 테이블과 두 벌이 되어 어긋난다.
 */
export async function listProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<ProfileRow[]> {
  const rows = await client`
    SELECT p.*, (pu.id IS NOT NULL) AS is_paid
    FROM profiles p
    LEFT JOIN purchases pu
      ON pu.profile_id = p.id
     AND pu.product = ${PRODUCT_FULL_REPORT}
     AND pu.status = 'paid'
    WHERE p.user_id = ${userId}::bigint
    ORDER BY p.created_at DESC
  `;
  return rows.map(toProfileRow);
}

/**
 * 내 프로필 하나. isPaid 파생은 listProfiles 와 같다.
 *
 * ⚠️ user_id 조건이 이 함수의 존재 이유다. profiles.id 는 순번 bigint 라
 * URL(/report?profile=<id>)에 노출된다 — id 만으로 찾으면 파라미터를 증가시켜
 * 남의 생년월일을 읽을 수 있다.
 *
 * id 는 호출자가 형식을 검증해 넘긴다(parseProfileParam). 검증 없이 오면
 * ::bigint 캐스팅에서 DB 에러가 난다.
 */
export async function getProfile(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<ProfileRow | null> {
  const rows = await client`
    SELECT p.*, (pu.id IS NOT NULL) AS is_paid
    FROM profiles p
    LEFT JOIN purchases pu
      ON pu.profile_id = p.id
     AND pu.product = ${PRODUCT_FULL_REPORT}
     AND pu.status = 'paid'
    WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toProfileRow(row) : null;
}

export async function countProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<number> {
  const rows = await client`
    SELECT count(*)::int AS n FROM profiles WHERE user_id = ${userId}::bigint
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * 프로필 생성. 한도 검사는 앱 레벨이라 동시 요청에서는 한 개쯤 더 들어갈 수 있다.
 * 트랜잭션을 걸지 않는 이유: 개수 한도는 UX 가드일 뿐 정합성 요건이 아니다.
 * 실제 비용 방어는 개수가 아니라 LLM 생성 호출에 걸어야 한다.
 */
export async function createProfile(
  userId: string,
  input: CreateProfileInput,
  client: SqlClient = sql,
): Promise<{ id: string }> {
  const count = await countProfiles(userId, client);
  if (count >= MAX_PROFILES) throw new ProfileLimitError();

  const rows = await client`
    INSERT INTO profiles (
      user_id, name, gender, calendar, is_leap_month,
      birth_year, birth_month, birth_day,
      time_known, birth_hour, birth_minute,
      birth_country, birth_region_id, true_solar
    ) VALUES (
      ${userId}::bigint, ${input.name}, ${input.gender}, ${input.calendar}, ${input.isLeapMonth},
      ${input.birth.year}, ${input.birth.month}, ${input.birth.day},
      ${input.timeKnown}, ${input.time?.hour ?? null}, ${input.time?.minute ?? null},
      ${input.birthPlace?.country ?? null}, ${input.birthPlace?.regionId ?? null}, ${input.trueSolar}
    )
    RETURNING id
  `;
  const row = rows[0] as { id: string | number } | undefined;
  if (!row) throw new Error("createProfile: no row returned");
  return { id: String(row.id) };
}
