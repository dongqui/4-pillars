# 프로필당 관계 지도 · 프로필 소프트 삭제 — 설계

작성일: 2026-10-02
기준 커밋: `76d0d17`
상태: 구현 전 설계. 이 문서를 쓰면서 코드·DB 는 건드리지 않았다.

---

## 1. 문제

홈에서 프로필을 바꿔도 **관계 지도와 고민상담 목록이 안 바뀐다.** 증상이 둘이지만 원인은 하나다 — 두 기능이 **계정**에 묶여 있고 프로필에 안 묶여 있다.

지도:

- `maps` 에 `profile_id` 가 없다. [0021_maps_owner_idx.sql](../../../migrations/0021_maps_owner_idx.sql) 의 `UNIQUE INDEX maps_owner_user ON maps(owner_user_id)` 가 **계정당 하나**를 박아 둔다.
- [map/page.tsx:18](../../../src/app/map/page.tsx:18) 이 `getMapByOwner(userId)` 로 찾아 있으면 바로 redirect 한다. 프로필을 보는 것은 지도를 **처음 만들 때 한 번뿐**이고, 그때 중심 생년월일을 복사해 넣는다. 같은 파일 36번째 줄에 이미 적혀 있다 — "primary_profile_id 를 나중에 홈에서 바꿔도 이미 만들어진 지도의 중심은 안 따라온다."

상담:

- `consultations.profile_id` 는 **이미 있다**([0012_consultations.sql](../../../migrations/0012_consultations.sql)). 상담을 열 때 `?profile` 로 대상을 고르는 것도 이미 된다.
- 묶이지 않은 것은 **목록**이다. [consultations/store.ts:142](../../../src/lib/consultations/store.ts:142) 의 `listConsultations(userId)` 가 `WHERE c.user_id = …` 뿐이라, 어느 프로필을 골라도 계정의 모든 상담이 한 줄에 선다.

선례는 바로 옆에 있다. `flows` 는 `profile_id` FK + `UNIQUE (profile_id, flow_year)` 로 프로필당 상품 하나를 만들고, 유니크에서 `user_id` 를 **일부러 뺐다**([0040_flows_unique.sql](../../../migrations/0040_flows_unique.sql)) — 프로필이 이미 한 사용자에 속하므로 넣으면 유니크가 뜻을 잃는다. 지도도 같은 모양을 쓴다.

---

## 2. 원칙

**소유 단위는 프로필이다.** 사람 단위로 말이 되는 것(관계 지도, 상담 이력, 흐름 리포트, 궁합)은 전부 프로필에 묶는다. 계정은 프로필을 담는 그릇일 뿐이다.

**지도를 볼 수 있는 프로필 = 홈에서 고를 수 있는 프로필.** 구체적으로 `kind = 'saved'` 이고 지워지지 않은 것. `listProfiles` 가 이미 `kind='saved'` 로 거르므로(`store.ts:158`) 이 정의가 곧 그 함수의 결과다. 궁합 한 번 보려고 만든 `temp` 프로필은 지도를 갖지 않는다 — 어느 목록에도 안 서는 사람에게 공유 링크가 생기면 되돌릴 길이 없다.

**지도는 프로필을 만들 때가 아니라 들어올 때 만든다.** 프로필 20개를 저장했다고 빈 지도 20개가 생기면, 하나도 안 쓴 공유 링크 20개와 중심이 안 서는 지도(만세력 범위 밖 생년월일)까지 미리 만들어 둔 셈이 된다. `/map` 진입이 GET 이면서 행을 만드는 지금 구조를 그대로 두되, 키만 프로필로 바꾼다.

---

## 3. 프로필 삭제를 소프트 삭제로

### 왜 지금 같이 하는가

프로필당 지도로 바꾸면 `maps` 가 `profiles` 를 참조하게 된다. 지금처럼 프로필을 진짜 지우면 그 참조가 끊기고, **이미 뿌린 공유 링크가 깨진다.** [0020_maps.sql](../../../migrations/0020_maps.sql) 이 중심 생년월일을 참조가 아니라 복사해 둔 이유가 정확히 그것이다 — "지도는 자기 완결적인 스냅샷이다."

그런데 이 문제는 지도만의 것이 아니다. 지금 `profiles(id)` 를 참조하는 곳이 여섯이고, 둘은 CASCADE 다:

| 테이블 | ON DELETE | 지금 프로필을 지우면 |
| --- | --- | --- |
| `flows.profile_id` | CASCADE | **산 흐름 리포트가 사라진다** |
| `matches.subject/counterpart_profile_id` | CASCADE | **본 궁합이 사라진다** |
| `purchases.profile_id` | CASCADE | 결제 기록의 프로필 연결이 사라진다 |
| `consultations.profile_id` | SET NULL | 이력은 남고 연결만 끊긴다 |
| `users.primary_profile_id` | SET NULL | "나" 가 비어 primary 가 다시 추론된다 |

`profiles/store.ts` 의 `deleteProfile` 주석은 `entitlements` 를 일부러 안 지운다고 적어 두었다 — "이때 이용권 몇 장을 냈는가 라는 결제 사실이 사라진다. 환불·CS 가 봐야 하는 기록이라 프로필보다 오래 남아야 한다." 그 판단은 `flows`·`matches` 에도 똑같이 적용돼야 하는데 지금은 안 되어 있다. 소프트 삭제가 그것까지 같이 고친다.

### 어떻게

```sql
-- 0050_profiles_deleted_at.sql
ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS profiles_user_live
  ON profiles(user_id) WHERE deleted_at IS NULL;
```

`deleted boolean` 이 아니라 `deleted_at timestamptz` 인 이유: 고아 청소가 "언제 지워진 것부터" 를 봐야 한다. 불리언이면 그 질문에 답할 수 없어서 청소 작업이 전부 아니면 아무것도가 된다.

`deleteProfile` 은 `DELETE` 대신 `UPDATE profiles SET deleted_at = now() WHERE id = … AND user_id = … AND deleted_at IS NULL RETURNING id` 로 바꾼다. `AND deleted_at IS NULL` 이 핵심이다 — 이미 지운 것을 또 지우면 `RETURNING` 이 비고, 핸들러가 지금처럼 404 를 돌려준다([api/profiles/[id]/_lib/handler.ts](../../../src/app/api/profiles/[id]/_lib/handler.ts) 의 docstring 이 "이미 지워진 프로필에 한 번 더 오는 경우도 404" 라고 약속한 동작이 그대로 유지된다).

**CASCADE 는 그대로 둔다.** 소프트 삭제가 걸린 뒤로 CASCADE 는 평소에 안 돈다 — 나중에 고아 청소가 행을 진짜 지울 때만 돈다. 그때는 흐름·궁합·지도가 같이 사라지는 것이 맞다. 즉 CASCADE 의 의미가 "사용자가 지우면" 에서 "우리가 치울 때" 로 바뀐다.

### 지워진 프로필을 누가 보는가

필터는 전부 **store 안**에 둔다. 호출부 서른 곳이 `deleted_at IS NULL` 을 각자 적는 순간 한 곳이 빠지고, 그 한 곳이 지워진 사람을 셀렉터에 다시 세운다.

| 함수 | 지워진 프로필 | 이유 |
| --- | --- | --- |
| `listProfiles` | **제외** | 홈·상담·궁합·흐름·지도의 셀렉터가 전부 이걸 쓴다 |
| `countProfiles` | **제외** | `MAX_PROFILES` 20 이 지운 사람까지 세면 안 된다 |
| `getProfile` | **제외** | 새 상담·새 흐름·새 궁합을 지워진 사람으로 열 수 없다 |
| `getProfileById` (신규) | **포함** | 이미 산 물건을 읽는 세 곳 전용 |

`getProfileById` 가 필요한 곳은 셋이다. 전부 **이미 만들어진 산출물의 주인**을 읽는 자리고, 지금은 `if (!profile) notFound()` 라 프로필이 사라지면 산 리포트가 404 가 된다:

- [flow/[id]/page.tsx:73](../../../src/app/flow/[id]/page.tsx:73)
- [match/[id]/page.tsx:78](../../../src/app/match/[id]/page.tsx:78)
- [api/consultations/[id]/messages/route.ts:51](../../../src/app/api/consultations/[id]/messages/route.ts:51) — 여기는 이미 null 일 때 primary 로 물러서는 코드가 있다. 소프트 삭제 뒤에는 **진짜 그 사람의 원국으로** 이어가게 되므로 그 물러섬이 덜 쓰인다(계정에 프로필이 하나도 없을 때만).

이 셋이 소프트 삭제로 **좋아지는** 부분이다 — 돈 주고 산 리포트가 프로필 삭제로 안 날아간다.

### 고아 청소

이번 범위가 아니다. 다만 청소 작업이 나중에 기댈 수 있게 사실만 정해 둔다:

- 지워진 프로필은 `deleted_at IS NOT NULL` 로 전부 찾을 수 있다.
- 그 행을 `DELETE` 하면 기존 CASCADE 가 `flows`·`matches`·`purchases`·`maps` 를 같이 지우고, `consultations`·`users.primary_profile_id` 는 NULL 이 된다.
- 즉 청소 스크립트가 할 일은 "유예 기간이 지난 `deleted_at` 행을 DELETE" 한 줄이다. 그 전에 사람이 봐야 할 것(환불 중인 결제 등)을 어떻게 거를지는 그 작업에서 정한다.

---

## 4. 지도를 프로필당 하나로

### 스키마

```sql
-- 0051_maps_profile.sql
ALTER TABLE maps ADD COLUMN profile_id bigint REFERENCES profiles(id) ON DELETE CASCADE;
```

```sql
-- 0052_maps_profile_backfill.sql
UPDATE maps m
   SET profile_id = u.primary_profile_id
  FROM users u
 WHERE u.id = m.owner_user_id
   AND m.profile_id IS NULL
   AND u.primary_profile_id IS NOT NULL;
```

```sql
-- 0053_maps_profile_unique.sql
DROP INDEX IF EXISTS maps_owner_user;
CREATE UNIQUE INDEX IF NOT EXISTS maps_profile ON maps(profile_id);
```

세 가지를 짚어 둔다.

**`owner_user_id` 는 남긴다.** 지도에 올라온 사람을 지울 권한이 소유자에게만 있고([api/maps/[share]/people/[id]](../../../src/app/api/maps/[share]/people/[id]/route.ts)), 그 검사는 프로필이 아니라 계정으로 한다. 프로필을 거쳐 계정을 찾는 조인을 매 요청에 추가할 이유가 없다.

**유니크는 `profile_id` 하나다.** `flows_unique` 가 `user_id` 를 뺀 것과 같은 이유 — 프로필이 이미 한 사용자에 속해서, 넣으면 같은 프로필의 지도가 사용자별로 여럿일 수 있는 상태가 표현 가능해진다.

**백필이 안 되는 행은 `profile_id IS NULL` 로 남는다.** Postgres 는 유니크 인덱스에서 NULL 을 서로 다른 값으로 보므로 여러 행이 공존해도 인덱스가 막지 않는다. 이 행들은 **공유 링크로는 계속 열리고**(`/map/[share]` 는 `share_id` 로만 찾는다) `/map` 진입에서는 안 잡혀, 그 프로필로 들어가면 새 지도가 생긴다. primary 가 없는 계정은 지금도 `/map` 이 프로필을 훑어 중심을 세우는 경로라 데이터가 적은 쪽이고, 이 상태를 특별히 더 다루지 않는다.

### `createMap` / `getMapByOwner`

`getMapByOwner(userId)` → `getMapByProfile(profileId)` 로 바꾼다. `createMap` 의 `ON CONFLICT (owner_user_id)` 는 `ON CONFLICT (profile_id)` 가 된다 — **인덱스를 바꾸는 마이그레이션과 같은 변경에 들어가야 한다.** 따로 가면 그 사이에 배포된 코드가 없는 인덱스를 겨냥한다.

읽기-삽입-읽기 구조는 그대로다. `/map` 진입이 GET 이라 멱등해야 하고, 흔한 경로("이미 있는 지도")가 읽기 전용이어야 한다는 판단이 바뀌지 않았다.

### `/map` 진입

```
/map            → primary 프로필의 지도
/map?profile=7  → 7번 프로필의 지도
```

순서:

1. 세션 없으면 `/login?next=…`.
2. `parseProfileParam` 으로 `?profile` 을 읽는다. `invalid` 는 `absent` 와 같이 다룬다 — 지도는 리포트와 달리 "남의 것을 보고 있다" 는 오해가 생길 화면이 아니고, 404 로 끊는 것보다 내 지도로 보내는 편이 낫다.
3. `listProfiles(userId)` 로 **고를 수 있는 프로필**을 받는다(= `saved` + 살아 있는 것).
4. 요청된 id 가 그 목록에 없으면 primary 로, primary 도 없으면 목록에서 중심이 서는 첫 프로필로 물러선다. 지금 `map/page.tsx` 가 이미 하는 일이고, 그 `pickMapCenter` 폴백 로직을 그대로 쓴다.
5. 하나도 중심이 안 서면 `/funnel?step=name`.
6. `getMapByProfile` → 있으면 redirect, 없으면 `createMap` 후 redirect.

4번이 중요하다. 지금은 `getMapByOwner` 가 맨 앞에 있어 **프로필을 아예 안 보고** 끝나는데, 이제 프로필을 먼저 확정하고 그 다음에 지도를 찾는다. "홈에서 고를 수 있는 프로필만 지도를 본다" 가 여기 한 줄로 걸린다.

### `/map` 으로 보내는 링크 네 곳

전부 `?profile` 이 없다 — [home/ExploreGrid.tsx:73](../../../src/app/home/_components/ExploreGrid.tsx:73), [report/RelatingSection.tsx:35](../../../src/app/report/_components/RelatingSection.tsx:35), [flow/v2-sections.ts:28](../../../src/app/flow/[id]/_lib/v2-sections.ts:28), 로그인 `next=/map`.

**그대로 둔다.** 파라미터가 없으면 primary 로 떨어지고, primary 는 홈 셀렉터에서 마지막으로 고른 사람이다(`HomeIdentity` 의 `rememberPick`). 즉 "홈에서 어머니를 고르고 관계 지도를 누르면 어머니 지도가 열린다" 가 링크를 안 고쳐도 성립한다. 리포트·흐름에서 들어오는 두 곳은 그 리포트의 프로필을 넘기는 편이 더 정확하지만, 이번 범위 밖으로 둔다(§8).

---

## 5. 상담 목록을 프로필로 거르기

열 때는 이미 프로필을 고른다. 목록만 안 걸러진다.

```ts
listConsultations(userId)  →  listConsultations(userId, profileId)
```

`WHERE c.user_id = … AND c.profile_id = …` 를 더한다. `user_id` 조건을 빼지 않는 이유: `profile_id` 는 NULL 일 수 있고(옛 행, 그리고 `SET NULL` 이 돈 행) 그 상태에서 조건이 하나면 남의 행이 섞일 틈이 생긴다. 두 조건을 다 걸면 그 틈이 없다.

`/consult` 페이지는 이미 `profileId` 를 계산해 `ConsultBoard` 에 넘긴다(`consult/page.tsx` 의 `asked` → `profileId`). 그 값을 `listConsultations` 에도 넘기면 된다 — **새 상태를 만들지 않는다.**

`profile_id IS NULL` 인 옛 상담은 어느 프로필 목록에도 안 선다. 지금 DB 에 그런 행이 있는지는 구현 때 세어 보고, 있으면 primary 로 백필할지 그냥 둘지 정한다(§8).

---

## 6. 안 바꾸는 것

- **`/map/[share]`** — `share_id` 로만 찾고 중심은 복사된 스냅샷이라 손댈 것이 없다. 프로필이 지워져도 열린다.
- **사람 추가·삭제 API** (`/api/maps/[share]/people/…`) — 전부 `share_id` + 소유자 계정으로 돌고, 프로필을 모른다.
- **`MAX_MAP_PEOPLE = 50`** — 지도당 상한이다. 프로필당 지도가 되면 계정 전체로는 늘지만, 상한의 근거는 배치의 기하학(한 지도 안의 겹침)이라 그대로다.
- **공유 버튼** — 지금 보고 있는 지도의 링크를 공유한다. 계정에 링크가 여럿이 되지만 버튼의 의미는 안 바뀐다.
- **`entitlements`** — 프로필을 소프트 삭제해도 안 건드린다. 지금 `deleteProfile` 이 안 지우는 것과 같다.

---

## 7. 테스트

소프트 삭제:

- `deleteProfile` 이 행을 안 지우고 `deleted_at` 을 찍는다. 두 번째 호출은 false.
- `listProfiles` · `countProfiles` · `getProfile` 이 지워진 행을 안 돌려준다.
- `getProfileById` 는 돌려준다.
- 프로필을 지운 뒤에도 그 프로필의 `flows` · `matches` 행이 남아 있다(지금은 CASCADE 로 사라진다 — **이 테스트가 지금 코드에서 실패해야 맞다**).

지도:

- `getMapByProfile` 이 프로필로 찾는다. 다른 프로필의 지도는 안 잡힌다.
- `createMap` 이 같은 프로필에 두 번 불려도 행이 하나다(멱등).
- 한 계정의 두 프로필이 서로 다른 지도를 갖는다 — **이 테스트가 이번 변경의 전부다.**
- `/map?profile=` 에 (a) 남의 프로필 id (b) `temp` 프로필 id (c) 지워진 프로필 id 를 주면 전부 내 primary 지도로 떨어진다.
- 지도가 없는 프로필로 들어가면 만들어지고, 프로필을 만든 것만으로는 안 생긴다.

상담:

- `listConsultations` 가 프로필로 거른다. 다른 프로필의 상담은 안 나온다.
- `profile_id IS NULL` 인 행은 어느 목록에도 안 선다.

마이그레이션은 로컬 개발 DB 에서 순서대로 돌려 본다. **워크트리들이 같은 개발 DB 를 공유하므로**, 이 마이그레이션을 돌린 순간 머지 전까지 다른 브랜치의 `/consult`·`/map` 이 500 을 맞을 수 있다. 알고 돌린다.

---

## 8. 미결 — 구현 전에 정해야 할 것

1. **`profile_id IS NULL` 인 옛 상담.** 개수를 세고, primary 로 백필할지 그냥 둘지 정한다. 백필하면 "지워진 프로필의 상담" 이 엉뚱한 사람 목록에 선다.
2. **리포트·흐름에서 `/map` 으로 들어갈 때 그 리포트의 프로필을 넘길지.** 넘기는 쪽이 정확하지만, 링크 두 곳과 `ctaHref` 를 고쳐야 하고 이번 변경 없이도 동작은 맞다.
3. **지도를 지우는 길이 아직 없다.** `map/page.tsx` 의 주석이 이미 지적한 구멍이다 — 중심이 안 서는 지도가 만들어지면 DB 를 손으로 지워야 풀린다. 프로필당 지도가 되면 지도가 여러 개 생기므로 이 구멍이 더 자주 보인다. 별 건으로 둔다.
4. **유예 기간.** 고아 청소가 `deleted_at` 으로부터 며칠 뒤에 도는지. 청소 작업을 만들 때 정한다.

---

## 부록 · 지금 개발 DB 에서 벌어질 일

| | |
| --- | --- |
| `users` | id 1 (primary=2), id 9 (primary=4) |
| `profiles` | 2 김동진(saved, user 1) · 4,5 홍길동(saved, user 9) · 6 곽희경(**temp**, user 1) · 7 백상현(saved, user 1) |
| `maps` | 1건, owner=1, 중심 김동진, 사람 24명 |

백필 결과: 지도 1번이 **프로필 2(김동진)** 에 붙는다. 목데이터 24명도 같이 간다. 프로필 7(백상현)로 `/map` 에 들어가면 빈 지도가 새로 생기고, 프로필 6(곽희경)은 `temp` 라 셀렉터에 없으므로 지도를 갖지 않는다. 계정 9 는 지도가 없어 primary(4)로 들어갈 때 처음 만들어진다.
