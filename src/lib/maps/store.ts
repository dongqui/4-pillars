import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { BirthLite, MapPersonRow, MapRow } from "./types";

// 타입은 types.ts 가 소유한다 — 순수 모듈(to-map-people.ts)이 같은 타입을 쓰면서
// 이 파일을 거쳐 @/lib/db 를 끌고 오지 않게 하기 위해서다. 호출부 편의를 위해
// 여기서 다시 내보낸다.
export type { BirthLite, MapPersonRow, MapRow, SqlClient };

const sql = neonSql as unknown as SqlClient;

/**
 * 지도당 인원 상한.
 *
 * 임의의 숫자가 아니라 배치의 기하학에서 나온 값이다(설계 §1.3). 기본 소구역은
 * 8명까지 최소 이웃거리 10px 을 유지하고 그 다음부터 무너진다(코어 지름 4.9px).
 * 사람의 10/12 가 기본 상태이고 Role 5개로 갈리므로 칸당 ≈ N/6 이고, 8을
 * 대입하면 N ≈ 48 이다. 올리려면 §1.3 의 측정을 다시 해야 한다.
 */
export const MAX_MAP_PEOPLE = 50;

export class MapPeopleLimitError extends Error {
  constructor() {
    super(`한 지도에는 최대 ${MAX_MAP_PEOPLE}명까지 추가할 수 있습니다`);
    this.name = "MapPeopleLimitError";
  }
}

function calendarOf(v: unknown): "solar" | "lunar" {
  return v === "lunar" ? "lunar" : "solar";
}

/** DB 행 → MapRow. 컬럼 이름을 아는 유일한 곳이다. */
export function toMapRow(r: Record<string, unknown>): MapRow {
  return {
    id: String(r.id),
    shareId: String(r.share_id),
    ownerUserId: String(r.owner_user_id),
    center: {
      name: String(r.center_name),
      year: Number(r.center_birth_year),
      month: Number(r.center_birth_month),
      day: Number(r.center_birth_day),
      calendar: calendarOf(r.center_calendar),
      isLeapMonth: r.center_is_leap_month === true,
    },
    createdAt: String(r.created_at),
  };
}

export function toMapPersonRow(r: Record<string, unknown>): MapPersonRow {
  return {
    id: String(r.id),
    name: String(r.name),
    year: Number(r.birth_year),
    month: Number(r.birth_month),
    day: Number(r.birth_day),
    calendar: calendarOf(r.calendar),
    isLeapMonth: r.is_leap_month === true,
  };
}

/**
 * 공개 링크로 지도를 찾는다. 소유자 조건이 없다 — 링크를 아는 누구나 본다.
 * 그 안전은 share_id 가 추측 불가능하다는 데서만 온다.
 */
export async function getMapByShareId(
  shareId: string,
  client: SqlClient = sql,
): Promise<MapRow | null> {
  const rows = await client`SELECT * FROM maps WHERE share_id = ${shareId}`;
  const row = rows[0];
  return row ? toMapRow(row) : null;
}

export async function getMapByOwner(
  userId: string,
  client: SqlClient = sql,
): Promise<MapRow | null> {
  const rows = await client`SELECT * FROM maps WHERE owner_user_id = ${userId}::bigint`;
  const row = rows[0];
  return row ? toMapRow(row) : null;
}

/**
 * 지도를 만든다. 이미 있으면 그것을 돌려준다 — /map 진입이 GET 이라 멱등해야 한다.
 *
 * ON CONFLICT DO NOTHING 만으로는 안 된다: 충돌하면 RETURNING 이 빈 결과라 돌려줄
 * 행이 없다. DO UPDATE 로 자기 자신을 갱신해 RETURNING 을 채우는 방법도 있지만,
 * /map 진입은 대부분 "이미 있는 지도" 라 흔한 경로가 읽기 전용이어야 한다.
 * 그래서 먼저 읽고, 없을 때만 넣고, 넣은 뒤 다시 읽는다.
 */
export async function createMap(
  userId: string,
  center: BirthLite & { name: string },
  client: SqlClient = sql,
): Promise<MapRow> {
  const existing = await getMapByOwner(userId, client);
  if (existing) return existing;

  const shareId = crypto.randomUUID();
  await client`
    INSERT INTO maps (
      share_id, owner_user_id, center_name,
      center_calendar, center_is_leap_month,
      center_birth_year, center_birth_month, center_birth_day
    ) VALUES (
      ${shareId}, ${userId}::bigint, ${center.name},
      ${center.calendar}, ${center.isLeapMonth},
      ${center.year}, ${center.month}, ${center.day}
    )
    ON CONFLICT (owner_user_id) DO NOTHING
  `;

  // 동시 요청이 먼저 넣었으면 위 INSERT 가 아무 일도 하지 않는다 — 그때도 여기서
  // 그 행을 읽어 온다. 이것이 이 함수가 멱등한 방식이다.
  const row = await getMapByOwner(userId, client);
  if (!row) throw new Error("createMap: 삽입 후에도 지도를 찾지 못했다");
  return row;
}

export async function listMapPeople(
  mapId: string,
  client: SqlClient = sql,
): Promise<MapPersonRow[]> {
  const rows = await client`
    SELECT * FROM map_people WHERE map_id = ${mapId}::bigint ORDER BY created_at ASC
  `;
  return rows.map(toMapPersonRow);
}

export async function countMapPeople(
  mapId: string,
  client: SqlClient = sql,
): Promise<number> {
  const rows = await client`
    SELECT count(*)::int AS n FROM map_people WHERE map_id = ${mapId}::bigint
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * map_people_dedupe 유니크 인덱스와 같은 컬럼으로 이미 있는 사람을 찾는다.
 * addMapPerson 이 INSERT 뒤에 딱 한 번 쓴다 — 새로 넣었든 이미 있었든 돌려줄
 * 행을 읽는 유일한 경로다.
 */
async function findMapPersonByDedupeKey(
  mapId: string,
  person: BirthLite & { name: string },
  client: SqlClient,
): Promise<MapPersonRow | null> {
  const rows = await client`
    SELECT * FROM map_people
    WHERE map_id = ${mapId}::bigint
      AND name = ${person.name}
      AND calendar = ${person.calendar}
      AND is_leap_month = ${person.isLeapMonth}
      AND birth_year = ${person.year}
      AND birth_month = ${person.month}
      AND birth_day = ${person.day}
  `;
  const row = rows[0];
  return row ? toMapPersonRow(row) : null;
}

/**
 * 사람이 지도에 있게 한다 — 한도 안이면, 없으면 더하고 이미 있으면 그 행을 그대로
 * 돌려준다. 한도를 넘었으면 있든 없든 똑같이 MapPeopleLimitError 다.
 *
 * "추가" 가 아니라 "있게 한다" 인 이유: 링크를 가진 누구나 이름·생년월일을 추측해
 * POST 할 수 있는데, 새로 더했을 때와 이미 있었을 때를 상태 코드로 가르면(201 대
 * 409) 그 코드 자체가 "이 생년월일이 맞다" 는 오라클이 된다. 50명 한도가 추측
 * 횟수를 얼마간 깎긴 하지만, 연·월을 이미 아는 추측자에게는 후보가 30개 안팎이라
 * 한도 안에 들어온다. 그래서 이미 있는 사람은 에러가 아니라 그 사람을 돌려주는
 * 성공이다 — 호출자 입장에서 새로 더한 것과 구별되지 않는다.
 *
 * ⚠️ 순서를 바꾸지 마라. 한도 검사가 **반드시 맨 먼저**다.
 *
 * dedupe 읽기를 먼저 두는 편이 더 자연스럽게 읽힌다("이미 있으면 아무것도 더해지지
 * 않으니 한도를 걸 이유가 없다"). 실제로 한 번 그렇게 고쳤고, 그것이 위에서 막
 * 닫은 오라클을 그대로 다시 열었다: 50명이 찬 지도에서 이미 있는 사람은 201,
 * 새 사람은 한도 409 가 된다. 빗나간 추측은 INSERT 를 아예 시도하지 않으므로
 * 슬롯도 안 줄고 행도 안 남는다 — 흔적 없이 무제한으로 생일을 물어볼 수 있다.
 * 연도를 아는 상대에게는 365번이면 끝난다. 설계 §6.1 이 고른 트레이드가 바로
 * 이것이다: "차고 나면 모든 추가가 한도 409 로 바뀌어 신호가 죽는다."
 *
 * 그 대가로 가득 찬 지도에 이미 있는 사람이 다시 제출하면 201 이 아니라 409 를
 * 받는다. 받아들이는 손해다 — 가득 찬 뒤에는 모든 추가가 똑같이 답하는 것이
 * 요점이고, 그때 지도에는 이미 쓰레기 50명이 훤히 보인다.
 *
 * 순서:
 *  1) countMapPeople. 한도면 던진다. 한도 검사는 앱 레벨이라 동시 요청에서 한 명쯤
 *     더 들어갈 수 있다 — profiles/store.ts 의 createProfile 과 같은 판단이다.
 *  2) INSERT ... ON CONFLICT DO NOTHING. RETURNING 을 쓰지 않고 결과도 보지 않는다.
 *  3) dedupe 키로 읽어 그 행을 돌려준다. 새로 넣었으면 방금 넣은 행이고, 이미
 *     있었거나 동시 요청이 먼저 넣었으면 그 행이다 — 호출자는 구별하지 못한다.
 *     비어 있으면 유니크 인덱스와 읽기가 서로 다른 말을 하는 것이라 사용자
 *     케이스가 아니라 버그다. 그냥 던진다.
 *
 * 이 모양이 타이밍 오라클도 함께 줄인다. 예전에는 중복이 왕복 1회, 신규가 왕복
 * 3회 + INSERT 라 둘 다 201 이어도 지연이 수십 ms 갈렸다. 이제는 두 경우가 같은
 * 문장 3개를 같은 순서로 지난다. 정직하게 말하면 **없어진 것이 아니라 줄어든**
 * 것이다 — INSERT 한 문장 안에서 "행을 썼는가, 아무 일도 안 했는가" 차이는 남는다.
 * 다만 그 차이는 왕복 하나가 아니라 한 문장 내부의 차이라 훨씬 작고, 관측하려면
 * 표본이 훨씬 많이 필요하다.
 */
export async function addMapPerson(
  mapId: string,
  person: BirthLite & { name: string },
  client: SqlClient = sql,
): Promise<MapPersonRow> {
  const count = await countMapPeople(mapId, client);
  if (count >= MAX_MAP_PEOPLE) throw new MapPeopleLimitError();

  await client`
    INSERT INTO map_people (
      map_id, name, calendar, is_leap_month, birth_year, birth_month, birth_day
    ) VALUES (
      ${mapId}::bigint, ${person.name}, ${person.calendar}, ${person.isLeapMonth},
      ${person.year}, ${person.month}, ${person.day}
    )
    ON CONFLICT DO NOTHING
  `;

  const row = await findMapPersonByDedupeKey(mapId, person, client);
  if (!row) {
    throw new Error("addMapPerson: INSERT 뒤에도 dedupe 키로 사람을 찾지 못했다");
  }
  return row;
}

/**
 * 사람을 지운다. 지운 행이 없으면 false.
 *
 * ⚠️ map_id 조건이 이 함수의 존재 이유다. map_people.id 는 순번 bigint 라, id 만으로
 * 지우면 다른 지도의 사람을 지울 수 있다 — profiles/store.ts 의 getProfile 이
 * user_id 를 함께 거는 것과 같은 이유다.
 */
export async function deleteMapPerson(
  mapId: string,
  personId: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    DELETE FROM map_people
    WHERE id = ${personId}::bigint AND map_id = ${mapId}::bigint
    RETURNING id
  `;
  return rows.length > 0;
}
