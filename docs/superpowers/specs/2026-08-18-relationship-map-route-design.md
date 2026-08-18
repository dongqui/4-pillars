# 관계 지도 — 실서비스 라우트 이전과 공유

날짜: 2026-08-18
대상: `src/app/lab/relationship-world/` → `src/app/map/`

## 0. 무엇을 만드는가

지금까지 `/lab/relationship-world` 는 mock 20명으로 도는 UI 스파이크였다. 이 문서는
그것을 다음 셋을 갖춘 실제 라우트로 옮긴다.

1. **실데이터** — 생년월일에서 사주 엔진이 관계를 계산한다. 손으로 적은 role/feature 가 사라진다.
2. **공유** — 지도마다 추측 불가능한 링크가 있고, 링크를 받은 사람은 로그인 없이 본다.
3. **누구나 추가** — 방문자가 자기 이름과 생년월일을 넣으면 그 지도에 영구히 남는다.

그리고 요청된 부수 항목 둘: 생년월일 추가 UI, 접히는 헤더바.

`src/app/lab/` 는 통째로 사라진다.

## 1. 이 설계가 기대는 사실

브레인스토밍 중 실측한 것들이다. 구현 중 이 전제가 흔들리면 설계도 흔들린다.

### 1.1 지도는 일주(日柱)만 쓴다

`getRelation(내 일주, 상대 일주)` 하나가 지도의 전부다(`src/lib/saju-core/relationship.ts`).
일주는 **출생 시각·경도·진태양시 보정과 무관하다** — 396개 날짜 × (시각 5종 + 경도 3종 +
보정 on/off) ≈ 3,500회 비교에서 일주가 달라진 경우가 **0**이었다.

따라서 추가 폼은 **이름 + 생년월일 + 양/음력**(음력이면 윤달)만 받는다. 성별·시각·출생지는
받지 않고 컬럼도 두지 않는다. 나중에 이 지도의 사람에게 전체 리포트가 필요해지면 답은
`map_people` 에 컬럼 14개를 복제하는 것이 아니라 그 사람을 `profiles` 로 승격하는 것이고,
그때 `map_people` 에 붙는 것은 `profile_id` 하나다. `0012_profiles_kind.sql` 의 주석이
같은 판단을 이미 적어뒀다("생년월일 컬럼 14개를 한 벌 더 복제하지 않아도 되고").

### 1.2 `positionFor` 는 지수 시간이다 — 반드시 고친다

`_lib/layout.ts:265` 의 `positionFor(role, feature, n)` 은 앞선 인덱스를 **재귀로 다시
계산**한다. 한 소구역 인원에 대해 T(n) ≈ 2^n 이다. 실측:

| 한 소구역 인원 | 배치 시간 |
|---|---|
| 8 | 3.5 ms |
| 12 | 23.1 ms |
| 16 | 281.8 ms |
| 18 | 1,177 ms |
| 20 | 4,662 ms |

지금 보이지 않는 이유는 mock 의 가장 붐빈 칸이 4명이기 때문이고, 그 함수의 주석이 바로
그 전제를 적어뒀다("mock 데이터에서 가장 붐빈 칸이 4명이라 재귀는 항상 얕다"). "누구나
추가" 는 그 전제를 깬다.

### 1.3 소구역의 기하학적 포화 지점

진입 카메라에서 1 월드 단위 ≈ 32.5px, 코어 지름 ≈ 4.9px. 소구역 인원별 최소 이웃거리:

| 인원 | 기본(퍼짐 1.35) | 六合(0.5) | 沖(0.5) |
|---|---|---|---|
| 4 | 34px | 17px | 9px |
| 6 | 34px | 7px | 5px |
| 8 | 10px | 6px | 5px |
| 12 | 8px | 1px | 1px |

`SPREAD` 는 **바꾸지 않는다.** 六合/沖 이 0.5 인 근거는 그 주석이 밝힌 대로 빈도가 각 8%
라는 것이고, 실데이터에서도 그 빈도는 유지된다(50명 지도면 六合 총 4명, Role 5개로 갈려
칸당 1명 안팎). 좁은 것이 문제가 되는 상황이 실제로는 오지 않는다.

병목은 기본 칸이다. **판정 기준은 최소 이웃거리 ≥ 코어 지름의 2배(9.8px, 월드 0.30)** 로
둔다 — 그 아래로 내려가면 두 사람이 한 점으로 읽힌다. 기본 칸은 8명에서 10px 로 이 문턱에
간신히 걸리고 그 다음부터 무너지므로 **칸당 상한은 8명**이다.

사람의 10/12 가 기본 상태이고 Role 5개로 갈리므로 칸당 ≈ N/6 이고, 8을 대입하면
**N ≈ 48**. 여기서 지도당 50명 상한이 나온다. 실제 분포는 균등하지 않아 한 칸이 먼저
포화될 수 있다 — 그때 그 칸의 사람들이 뭉쳐 보이는 것은 "이 구역에 사람이 많다" 로도
읽히므로 v1 은 감수한다.

## 2. 라우트

`src/app/lab/relationship-world/` 33개 파일을 `src/app/map/` 으로 그대로 옮기고
`src/app/lab/` 을 지운다. 내부 import 가 전부 상대경로라 경로 수정은 없다.

기존 `page.tsx` 는 둘로 갈린다: `/map/page.tsx` 는 리다이렉트만 하는 서버 컴포넌트가
되고(§2.1), 지금의 렌더 내용과 `metadata` 는 `/map/[share]/page.tsx` 로 간다.
스파이크 제목("관계 지도 스파이크")은 제품 문구로 바꾸고 `robots: { index: false }` 는
그대로 가져간다(§5.2).

| 라우트 | 접근 | 하는 일 |
|---|---|---|
| `/map` | 로그인 필요 | 내 지도로 보낸다. 없으면 만들어서 보낸다 |
| `/map/[share]` | **공개** | 지도를 렌더한다. 로그인·쿠키 불문 누구나 본다 |

### 2.1 `/map` 진입 흐름

```
1. session 없음                    → redirect('/login?next=/map')
2. maps WHERE owner_user_id = me   → 있으면 redirect('/map/<share_id>')
3. profiles WHERE kind='self' 없음 → redirect('/funnel?step=name')
4. 가장 먼저 만든 self 프로필로 지도 생성 → redirect('/map/<share_id>')
```

3번의 "가장 먼저 만든 것"(`ORDER BY created_at ASC LIMIT 1`)은 임의 선택이 아니다.
퍼널을 통과하며 만든 본인 사주가 그 자리이고, 드래프트 승격도 첫 행이 되므로 로그인
전후가 같은 사람을 가리킨다.

4번이 GET 에서 행을 만드는 것이 걸리지만, `maps_owner_user` 유니크 인덱스와
`ON CONFLICT DO NOTHING` 덕에 멱등하다. 새로고침해도 지도가 늘지 않는다.

**v1 은 사용자당 지도 하나다.** self 프로필을 여러 개 가진 사용자도 지도는 하나다.
프로필별 지도가 필요해지면 유니크 인덱스를 `(owner_user_id, center_profile_id)` 로
바꾸는 것이 출발점이다.

## 3. 데이터

### 3.1 `migrations/0020_maps.sql`

```sql
CREATE TABLE IF NOT EXISTS maps (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  share_id       text NOT NULL UNIQUE,
  owner_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_name    text NOT NULL,
  center_calendar      text NOT NULL DEFAULT 'solar' CHECK (center_calendar IN ('solar','lunar')),
  center_is_leap_month boolean NOT NULL DEFAULT false,
  center_birth_year    int NOT NULL,
  center_birth_month   int NOT NULL,
  center_birth_day     int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS maps_owner_user ON maps(owner_user_id);
```

`share_id` 가 PK 와 별도인 이유: `maps.id` 는 `bigint GENERATED ALWAYS AS IDENTITY` 라
연속 정수다. 공개 URL 에 그대로 쓰면 `/map/1`, `/map/2` 를 훑어 남의 지도를 전부 열 수
있다. `share_id` 는 `crypto.randomUUID()` 로 만든다.

중심 생년월일을 `profiles` 참조가 아니라 **복사**하는 이유: 소유자가 프로필을 지웠을 때
이미 뿌린 공유 링크가 깨지면 안 된다. 지도는 자기 완결적인 스냅샷이다.

원국이 아니라 생년월일을 저장하는 것은 `0005_profiles.sql` 이 정한 기존 규칙을 따른다
("원국은 파생값이다").

### 3.2 `migrations/0021_map_people.sql`

```sql
CREATE TABLE IF NOT EXISTS map_people (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  map_id        bigint NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name          text NOT NULL,
  calendar      text NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar','lunar')),
  is_leap_month boolean NOT NULL DEFAULT false,
  birth_year    int NOT NULL,
  birth_month   int NOT NULL,
  birth_day     int NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_people_map ON map_people(map_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS map_people_dedupe
  ON map_people(map_id, name, birth_year, birth_month, birth_day, calendar, is_leap_month);
```

`map_people_dedupe` 는 중복 제출(더블탭, 새로고침 재전송)을 DB 층에서 막는다.

### 3.3 저장소 모듈

`src/lib/maps/store.ts` — 컬럼 이름을 아는 유일한 곳. `src/lib/profiles/store.ts` 의
`toProfileRow` 와 같은 형태를 따른다.

```ts
export const MAX_MAP_PEOPLE = 50;   // §1.3 에서 나온 숫자
export class MapPeopleLimitError extends Error {}
export class DuplicatePersonError extends Error {}

export type MapRow = { id, shareId, ownerUserId, center: BirthLite & { name }, createdAt };
export type MapPersonRow = { id, name } & BirthLite;
export type BirthLite = { year, month, day, calendar: "solar"|"lunar", isLeapMonth: boolean };

getMapByShareId(shareId): Promise<MapRow | null>
getMapByOwner(userId): Promise<MapRow | null>
createMap(userId, center): Promise<MapRow>          // 멱등 — 아래 주석 참고
listMapPeople(mapId): Promise<MapPersonRow[]>
addMapPerson(mapId, person): Promise<MapPersonRow>  // 한도·중복 검사
deleteMapPerson(mapId, personId): Promise<void>
```

`createMap` 의 멱등성은 `ON CONFLICT DO NOTHING` 만으로는 안 된다 — 충돌하면 `RETURNING`
이 **빈 결과**를 주므로 돌려줄 행이 없다. 두 방법 중 하나를 쓴다:

```sql
-- (a) 충돌 시 자기 자신으로 갱신해 RETURNING 을 항상 채운다
INSERT INTO maps (...) VALUES (...)
ON CONFLICT (owner_user_id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
RETURNING *;
```

(b) `DO NOTHING` 후 결과가 비면 `getMapByOwner` 로 한 번 더 읽는다. (a) 는 왕복이 한
번이지만 충돌마다 쓸모없는 UPDATE 가 돌고, (b) 는 왕복이 둘이지만 쓰기가 없다. **(b)를
쓴다** — `/map` 진입은 대부분 "이미 있는 지도" 라 흔한 경로가 읽기 전용이어야 한다.

## 4. 관계 계산

### 4.1 순수 모듈

`src/app/map/_lib/to-map-people.ts` — **three 를 import 하지 않는다.** 이 라우트의
`_lib`/`_data` 규약을 따라 node 환경 테스트로 잠근다.

```ts
export type MapPerson = {
  id: string; name: string;
  role: RelationRole; feature: Feature;
  pillarKey: string; sceneName: string;
  /** 일주가 통째로 같은가. feature 로는 표현되지 않는 사실이라 따로 싣는다(§4.2). */
  sameDayPillar: boolean;
};

export function toMapPerson(centerDay: DayPillarInput, row: MapPersonRow): MapPerson | null;
```

`buildPillars({year, month, day, calendar, isLeapMonth})` → `chart.day` →
`getRelation(centerDay, theirDay)`. 만세력이 못 세우는 값이면 `null` 을 돌려주고 호출부가
걸러낸다(리빌이 `characterOfBirth` 실패를 다루는 것과 같은 태도).

### 4.2 매핑

| `RelationKind` | Role | 명리 |
|---|---|---|
| 생아 | `fill` | 인성 |
| 비아 | `beside` | 비겁 |
| 아생 | `express` | 식상 |
| 아극 | `move` | 재성 |
| 극아 | `refine` | 관성 |

배지: `육합` → `yukhap`, `충` → `chung`, 그 외 → `none`.

**`동일일주` 는 네 번째 배지라 지도에 자리가 없다.** 六合 도 沖 도 아니므로 `feature` 는
`none` 으로 접고, 대신 `sameDayPillar: true` 를 실어 상세 시트가
`BADGE_LABELS.동일일주.hint`("일주가 통째로 같아요")를 보여준다. 배치는 기본이되 사실은
잃지 않는다.

`pillarKey`·`sceneName` 은 `characterFromChart` 가 만든다 — mock 의 손글씨 값을 대체한다.

### 4.3 `positionFor` 수정

재귀를 없애고 한 번에 순회한다.

```ts
export function placeSubRegion(role, feature, count): Vec3[] {
  const placed: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const farEnough = (p: Vec3) => placed.every((o) => dist3(p, o) >= MIN_SEPARATION);
    let candidate = sampleCandidate(role, feature, i, 0);
    for (let a = 1; a <= MAX_ATTEMPTS && !farEnough(candidate); a++) {
      candidate = sampleCandidate(role, feature, i, a);
    }
    placed.push(candidate);
  }
  return placed;
}

export function positionFor(role, feature, index): Vec3 {
  return placeSubRegion(role, feature, index + 1)[index];
}
```

`placePeople` 은 칸마다 `placeSubRegion` 을 한 번씩 부른다.

**좌표는 완전히 동일하다** — 5 role × 3 feature × index 0..13 전부에서 기존 구현과 차이
0으로 확인했다. 샘플링 순서가 그대로이기 때문이다. 기존 `layout.test.ts` 가 하나도 수정
없이 통과해야 한다. 200명이 60ms 다.

## 5. 화면

### 5.1 실데이터 배선

`World.tsx` 가 모듈 상수 `FRIENDS` 를 직접 import 하던 것을 props 로 바꾼다. 서버가 읽은
목록을 `WorldShell` 이 내려준다.

중심(나)도 같이 내려간다. `SelfCore.tsx` 가 `_data/mock-people` 의 `SELF` 를 직접
import 해 이름을 그리고 있으므로, 이것도 props 로 바꾼다. `PeopleList`·`RegionLabels`
(15칸 인원수)는 `World.tsx` 가 받은 목록에서 파생되므로 추가 배선이 없다.

`_data/mock-people.ts` 는 **남긴다** — `layout.test.ts` 와 `node-visual.test.ts` 가
`FRIENDS` 를 고정 표본으로 쓴다. 테스트 픽스처로 유지하고 화면에서만 뗀다.

### 5.2 `/map/[share]`

서버 컴포넌트가 `getMapByShareId` → `listMapPeople` → `toMapPerson` 을 거쳐 `WorldShell`
에 넘긴다. 없는 `share_id` 는 `notFound()`.

`metadata`: 제목 `"<이름>님의 관계 지도"`, 설명은 인원수 한 줄, **`robots: { index: false }`**.
링크를 아는 사람만 보는 것이 전제인데 검색에 잡히면 그 전제가 깨진다.

`isOwner = session?.userId === map.ownerUserId` 를 클라이언트로 내린다.

### 5.3 추가 UI

지도 위로 올라오는 다크 시트. `PeopleList`·`PersonSheet` 와 같은 자리라 **셋은 서로
배타적이다** — 하나가 열리면 나머지가 닫힌다(`WorldShell` 이 이미 목록/시트에 대해 하는 일).

받는 것: **이름 · 생년월일 · 양/음력**. 음력이고 `hasLeapMonth(y, m)` 이면 윤달 토글.
`match/_lib/to-counterpart.ts` 의 `digitsOnly`·`draftIssues` 검증을 재사용하되 성별·시각·
출생지 칸은 없다.

제출 → `POST /api/maps/[share]/people` → 목록 갱신 → **카메라가 새 노드로 날아가고 상세
시트가 열린다**. 방문자가 자기를 넣었을 때 보는 것이 그 화면이다("나는 이 사람에게
보조배터리").

### 5.4 헤더바

지도 위 다크 바. 왼쪽 `BrandLogo`(로그인이면 `/home`, 아니면 `/`), 오른쪽은 소유자면 공유
버튼.

숨김 규칙:

- 지도에 `pointerdown` 이 닿으면 즉시 숨김(`-translate-y-full`, 180ms)
- 빈 곳 탭에서 복귀 — 이미 있는 `onPointerMissed` 경로(선택 해제와 같은 자리)
- **시트·목록·추가 폼이 열려 있는 동안은 항상 보인다.** 그 위에서 나가는 길이 사라지면 갇힌다
- 숨겨진 상태에서도 상단에 높이 4px 손잡이를 남긴다. 탭하면 복귀
- `prefers-reduced-motion` 이면 트랜지션 없이 즉시 전환

### 5.5 공유

소유자에게만 보인다. `navigator.share` 가 있으면 OS 공유 시트, 없으면 클립보드 복사 +
"링크를 복사했어요" 토스트. 복사되는 것은 `${origin}/map/${share_id}` 하나다.

## 6. API

| 메서드 | 경로 | 권한 | 실패 |
|---|---|---|---|
| POST | `/api/maps/[share]/people` | 누구나 | 400 만세력 실패·형식 오류 / 404 없는 지도 / 409 50명 초과 / 409 중복 |
| DELETE | `/api/maps/[share]/people/[id]` | 소유자만 | 403 비소유자 / 404 |

지도 생성은 API 가 아니라 `/map` 서버 컴포넌트가 한다(§2.1).

소유자 판정은 `session.userId === map.ownerUserId` 하나뿐이다.

DELETE 의 비소유자에게 **403** 을 준다. `getProfile` 이 없는 프로필과 남의 프로필을 모두
404 로 접는 것과 다른 선택인데, 이유가 있다 — 거기서 404 인 것은 id 로 존재 여부를 훑는
것을 막기 위해서다. 여기서는 요청자가 `share_id` 를 이미 알고 있고 그 지도를 방금 보고
있으므로 존재는 이미 알려진 사실이고, 숨길 것이 없다.

**입력 검증은 zod 스키마 하나로 모은다**(`src/lib/maps/input.ts`, `profiles/input.ts` 와 같은
자리): 이름 1~20자, **연 1900~현재**, 월 1~12, 일 1~31, `calendar`, `isLeapMonth`.
연도 하한 1900 은 `profiles/input.ts:17` 과 같고, 상한을 2200 이 아니라 현재로 두는 것은
`match/_lib/to-counterpart.ts:53` 을 따른다 — 지도에 올라오는 사람은 이미 태어난 사람이다.
범위를 통과해도 만세력이 못 세우는 값이 있으므로 §4.1 의 `null` 처리가 최종 관문이다.

## 7. 권한 요약

| 행위 | 누가 |
|---|---|
| 지도 보기 | 누구나 (링크만 있으면) |
| 사람 추가 | 누구나 |
| 사람 삭제 | 소유자만 |
| 지도 만들기 | 로그인한 사용자 |

`PeopleList` 의 각 행에 삭제 버튼이 붙는다 — 소유자일 때만. 아무나 추가할 수 있으니 지울
수 있는 사람이 있어야 한다.

## 8. 테스트

이 라우트의 vitest 는 `environment: "node"` 다 — **React 컴포넌트는 테스트할 수 없다.**
그래서 규칙은 전부 순수 모듈로 내리고 node 테스트로 잠근다. 이 브랜치의 반복된 교훈이다:
초록불은 이 라우트에서 증거가 아니다.

| 파일 | 잠그는 것 |
|---|---|
| `_lib/layout.test.ts` | **수정 없이 통과해야 한다** — §4.3 이 좌표를 바꾸지 않았다는 증거 |
| `_lib/layout.test.ts` (추가) | `placeSubRegion` 이 50명에서 200ms 이내. 지수 회귀 방지 |
| `_lib/layout.test.ts` (추가) | 기본 칸 8명의 최소 이웃거리가 **0.30 월드**(코어 지름 2배, §1.3 기준) 이상 |
| `_lib/to-map-people.test.ts` | 5개 `RelationKind` → 5개 Role 전단사. 배지 3종 → feature |
| `_lib/to-map-people.test.ts` | 동일일주가 `feature: "none"` + `sameDayPillar: true` |
| `_lib/to-map-people.test.ts` | 만세력 실패 입력에 `null` |
| `lib/maps/input.test.ts` | zod 스키마 경계값 |
| `lib/maps/store.test.ts` | 한도 50, 중복 거절 (기존 `profiles/store.test.ts` 와 같은 방식) |

## 9. 하지 않는 것

- 지도 여러 개 / 프로필별 지도
- 방문자가 자기 상세 리포트 보기 (`map_people` → `profiles` 승격 경로)
- 지도에서 사람 수정
- 방문자 rate limit (v1 은 50명 상한과 중복 인덱스로 버틴다)
- `SPREAD`·`STATE_RADIUS`·색 체계 변경 — 15구역 설계가 정한 것을 그대로 둔다

## 10. 되돌리는 법

- **로그인 요구를 되돌리려면**: `maps.owner_user_id` 를 nullable 로 바꾸고 `owner_token`
  컬럼과 `map_owner` 쿠키(400일, Chrome 상한)를 더한 뒤, OAuth 콜백의 `promoteDraft`
  옆에 `promoteMap` 을 둔다. 브레인스토밍에서 검토했다가 단순함을 위해 접은 길이다.
- **50명 상한을 올리려면**: §1.3 의 측정을 다시 하고, 기본 칸 상한 8명이 어디서 깨지는지
  본다. 상한을 올리려면 `SPREAD` 를 키워야 하는데 그것은 15구역 설계를 건드리는 일이다.
