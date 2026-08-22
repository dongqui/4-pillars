import { sql as neonSql, type SqlClient } from "@/lib/db";

// 재수출 — store.test.ts 를 비롯한 기존 import 경로를 깨지 않는다.
export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

/** 한 계정이 저장할 수 있는 사람(kind='saved') 수. 화면 문구와 같이 움직인다. */
export const MAX_PROFILES = 20;

/**
 * 저장하지 않기로 한 행(kind='temp')의 상한. 훨씬 높은 별도 값이다.
 *
 * 두 상한이 갈리는 이유: MAX_PROFILES 는 "몇 명까지 목록에 두고 관리할 것인가" 라는
 * 제품 판단이고(홈 캐러셀에 늘어서는 카드 수다), 이쪽은 "행이 무한히 늘지 않게" 라는
 * 자원 상한이다. 궁합은 볼 때마다 temp 가 하나 늘 수 있어서, 세지 않고 두면 한 계정이
 * 보이지도 않는 영구 행을 끝없이 쌓는다.
 */
export const MAX_TEMP_PROFILES = 100;

export class ProfileLimitError extends Error {
  constructor() {
    super(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있습니다`);
    this.name = "ProfileLimitError";
  }
}

/**
 * 궁합 상대 상한. ProfileLimitError 와 다른 타입인 이유: 문구가 다르고(사용자가 지울
 * 대상이 내 사주가 아니라 궁합 상대다) 호출부가 갈라 다뤄야 한다.
 */
export class CounterpartLimitError extends Error {
  constructor() {
    super(`저장하지 않은 상대는 최대 ${MAX_TEMP_PROFILES}명까지 쌓을 수 있습니다`);
    this.name = "CounterpartLimitError";
  }
}

/**
 * 이 행을 목록에 둘 것인가 — 사용자가 입력 폼의 체크박스로 고른 것 하나만 나른다.
 *
 * 'saved' = 다음에도 골라 쓸 사람. 홈·상담·지도·궁합 어디서든 고를 수 있다.
 * 'temp'  = 이번 한 번만. 어느 목록에도 서지 않고, 그 궁합이 참조하는 행으로만 산다.
 *           나로 넣었든 상대로 넣었든 같은 값이다 — 어느 쪽이었는지는 matches 의
 *           subject/counterpart 컬럼이 안다.
 *
 * ⚠️ "누가 나인가" 는 여기 없다. 계정당 하나뿐인 사실이라 users.primary_profile_id
 * 가 답한다. 예전에는 kind='self' 가 그 대역을 겸했는데, self 가 20개까지 있을 수
 * 있어 대역이 되지 못했다 — 상담과 지도가 서로 반대인 휴리스틱으로 때우고 있었다.
 */
export type ProfileKind = "saved" | "temp";

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
  /** 출생지를 건너뛰면 null. toBirthInput 이 이 경우 longitude 를 넘기지 않아
   *  saju-core 기본값 127(서울)이 쓰인다 — 국가 기본 경도로 물러서지 않는다. */
  birthPlace: { country: string; regionId: string } | null;
  trueSolar: boolean;
  createdAt: string;
  /** entitlements 조인에서 파생 — 이 프로필의 전체 리포트에 이용권을 쓴 적이 있으면 true. */
  isUnlocked: boolean;
  /** 홈·프로필 목록은 'self' 만 본다. 'temp' 는 어디에도 뜨지 않는다. */
  kind: ProfileKind;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isUnlocked">;

/**
 * kind 컬럼 → ProfileKind.
 *
 * ⚠️ 모르는 값을 'saved' 로 접지 않는다. 아는 값만 통과시키고 나머지는 가장 덜 새는
 * 쪽('temp': 어디에도 안 뜬다)으로 접는다. 반대로 두면 값이 하나 늘어날 때마다 그
 * 새 값이 조용히 홈 캐러셀에 선다.
 */
function toKind(raw: unknown): ProfileKind {
  return raw === "saved" ? "saved" : "temp";
}

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
    isUnlocked: r.is_unlocked === true,
    kind: toKind(r.kind),
  };
}

/**
 * 저장한 사람들을 최신순으로. 열람 권한은 entitlements 를 LEFT JOIN 해 파생한다 —
 * profiles 에 컬럼을 두면 권한 테이블과 두 벌이 되어 어긋난다.
 *
 * subject_key 가 text 라 p.id 를 ::text 로 맞춘다. 반대로 subject_key 를
 * ::bigint 로 캐스팅하면 궁합의 '12:34' 같은 키에서 터진다.
 *
 * ⚠️ kind 를 인자로 받지 않는다. 예전에는 호출부마다 self/other/listed 중 하나를
 * 고르게 하고 "컴파일러가 강제한다" 고 적어 뒀는데, 정작 여섯 호출부가 원하는 답이
 * 전부 같았다 — 목록은 저장한 사람을 보여주는 자리다. 답이 하나뿐인 질문을 계속
 * 물으면 호출부 하나가 틀리는 길만 열어 둘 뿐이다. temp 에 닿는 길은 id 뿐이다
 * (getProfile) — 그게 "이번 궁합에만" 이라는 약속의 전부다.
 */
export async function listProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<ProfileRow[]> {
  // 'full_report' 는 상수가 아니라 리터럴로 적는다 — @/lib/tickets/features 를
  // import 하면 profiles 가 tickets 에 의존하게 되고, 무엇보다 이 값은 이미
  // entitlements 테이블에 문자열로 나가 있는 값이라 리팩터로 상수 이름이
  // 바뀌어도 함께 움직이면 안 되는 영속 계약이다.
  //
  // 조건을 문자열로 조립하지 않는다 — 태그드 템플릿의 이스케이프를 잃는다.
  // 두 쿼리를 나란히 두는 편이 안전하고, 읽는 사람이 무엇이 다른지 바로 본다.
  const rows = await client`
    SELECT p.*, (e.id IS NOT NULL) AS is_unlocked
    FROM profiles p
    LEFT JOIN entitlements e
      ON e.user_id = p.user_id
     AND e.feature = 'full_report'
     AND e.subject_key = p.id::text
    WHERE p.user_id = ${userId}::bigint AND p.kind = 'saved'
    ORDER BY p.created_at DESC
  `;
  return rows.map(toProfileRow);
}

/**
 * 내 프로필 하나. isUnlocked 파생은 listProfiles 와 같다.
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
    SELECT p.*, (e.id IS NOT NULL) AS is_unlocked
    FROM profiles p
    LEFT JOIN entitlements e
      ON e.user_id = p.user_id
     AND e.feature = 'full_report'
     AND e.subject_key = p.id::text
    WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toProfileRow(row) : null;
}

export async function countProfiles(
  userId: string,
  kind: ProfileKind,
  client: SqlClient = sql,
): Promise<number> {
  const rows = await client`
    SELECT count(*)::int AS n FROM profiles
    WHERE user_id = ${userId}::bigint AND kind = ${kind}
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
  // 한 카운터로 둘을 같이 세지 않는다. 궁합 상대까지 MAX_PROFILES 에 넣으면 궁합을
  // 몇 번 본 것만으로 내 사주를 더 저장할 수 없게 된다 — 한도의 취지와 무관한 결과다.
  //
  // 그렇다고 temp 를 세지 않고 두면 상한이 아예 없어진다. 그래서 kind 별로 자기
  // 카운터를 본다 — 가르는 선이 곧 kind 다.
  if (input.kind === "saved") {
    const count = await countProfiles(userId, "saved", client);
    if (count >= MAX_PROFILES) throw new ProfileLimitError();
  } else {
    const count = await countProfiles(userId, "temp", client);
    if (count >= MAX_TEMP_PROFILES) throw new CounterpartLimitError();
  }

  const rows = await client`
    INSERT INTO profiles (
      user_id, name, gender, calendar, is_leap_month,
      birth_year, birth_month, birth_day,
      time_known, birth_hour, birth_minute,
      birth_country, birth_region_id, true_solar, kind
    ) VALUES (
      ${userId}::bigint, ${input.name}, ${input.gender}, ${input.calendar}, ${input.isLeapMonth},
      ${input.birth.year}, ${input.birth.month}, ${input.birth.day},
      ${input.timeKnown}, ${input.time?.hour ?? null}, ${input.time?.minute ?? null},
      ${input.birthPlace?.country ?? null}, ${input.birthPlace?.regionId ?? null}, ${input.trueSolar},
      ${input.kind}
    )
    RETURNING id
  `;
  const row = rows[0] as { id: string | number } | undefined;
  if (!row) throw new Error("createProfile: no row returned");
  return { id: String(row.id) };
}

/**
 * 프로필 하나를 지운다. 없는 프로필과 남의 프로필을 구분하지 않고 둘 다 false 다 —
 * getProfile 과 같은 이유로 user_id 조건이 이 함수의 존재 이유다. profiles.id 는
 * URL 에 노출되는 순번 bigint 라, id 만으로 지우면 파라미터를 증가시켜 남의
 * 프로필을 지울 수 있다.
 *
 * 딸린 행은 스키마가 처리한다: matches·purchases 는 ON DELETE CASCADE,
 * consultations 는 SET NULL(이미 나눈 대화는 프로필이 사라져도 남는다).
 *
 * entitlements 는 함께 지우지 않는다. subject_key 가 text 라 FK 가 없고, id 는
 * IDENTITY 라 재사용되지 않으니 남은 행이 다른 프로필을 여는 일은 없다. 반대로
 * 지우면 "이때 이용권 몇 장을 냈는가" 라는 결제 사실이 사라진다 — 환불·CS 가 봐야
 * 하는 기록이라 프로필보다 오래 남아야 한다.
 */
export async function deleteProfile(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    DELETE FROM profiles
     WHERE id = ${id}::bigint AND user_id = ${userId}::bigint
    RETURNING id
  `;
  return rows.length > 0;
}
