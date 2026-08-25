# 홈에서 마지막으로 고른 프로필을 기본값으로

날짜: 2026-08-25
브랜치: `claude/profile-default-memory-02cbc5`

## 문제

홈 셀렉터(`HomeIdentity`)는 언제나 첫 줄(`index = 0`, `created_at DESC` 의 맨 위)로 시작한다.
프로필이 여럿인 사람은 홈에 들어올 때마다 자기가 보던 사주를 다시 골라야 한다.

## 결정

홈에서 고른 프로필을 그대로 계정의 "나"(`users.primary_profile_id`)로 승격한다.

별도의 "마지막으로 본 프로필" 축을 새로 만들지 않는다. 대신 기존 컬럼의 뜻을
**"계정의 첫 저장 프로필"에서 "홈에서 마지막으로 고른 사람"으로 넓힌다.**

따라오는 결과(의도한 것):

- `/map` 이 그 사람을 중심에 놓는다 (`map/page.tsx` 가 `primaryProfileId` 로 거른다)
- 상담 주체가 그 사람이 된다 (`lib/consultations/subject.ts`)
- 궁합의 "나" 칸 기본값이 그 사람이 된다 (`match/page.tsx` → `defaultSubjectId`)

즉 앱 전체가 "지금 보고 있는 사주" 하나를 공유한다. 홈이 그 하나를 정하는 유일한 자리다.

### 승격하지 않는 것

**궁합 화면의 "나" 칸**은 바꿔도 승격하지 않는다. 그 화면 안에서만 살고 끝난다.
한 번짜리 비교를 하려고 남을 골랐다가 계정의 "나"까지 바뀌는 사고를 막는다.

## 데이터

새 컬럼 없음. 마이그레이션 없음. `users.primary_profile_id` 를 계속 쓴다.

`setPrimaryProfileIfUnset`(첫 저장 프로필을 자동으로 "나"로 정하는 기존 함수)은 그대로 둔다 —
아직 아무것도 고르지 않은 계정의 초기값 역할이라 새 뜻과 충돌하지 않는다.

`primary_profile_id` 가 null 일 때의 물러섬도 그대로다: 홈은 첫 줄, 지도·상담은 가장 오래된
저장 프로필.

옛 뜻을 설명하는 주석 세 곳을 새 뜻으로 고친다:

- `migrations/0029_users_primary_profile.sql`
- `src/lib/auth/users.ts` 의 `UserProfile.primaryProfileId` 독스트링
- `src/lib/profiles/store.ts:47`

## 구조

레포의 기존 3단을 그대로 따른다: 얇은 `route.ts` + 순수 `_lib/handler.ts`(deps 주입) + `lib/*/store`.
서버 액션은 이 레포에 전례가 없어 쓰지 않는다.

### `lib/auth/users.ts` — `setPrimaryProfile(userId, profileId, client?)`

`setPrimaryProfileIfUnset` 과 달리 이미 정해진 값을 덮어쓴다. 대신 소유권과 종류를
WHERE 안에서 건다:

```sql
UPDATE users SET primary_profile_id = $profileId::bigint
 WHERE id = $userId::bigint
   AND EXISTS (
     SELECT 1 FROM profiles p
      WHERE p.id = $profileId::bigint
        AND p.user_id = $userId::bigint
        AND p.kind = 'saved'
   )
```

- `user_id` 조건: `profiles.id` 는 순번 bigint 라 URL 에 노출된다. 없으면 남의 프로필을
  자기 "나"로 박을 수 있다.
- `kind = 'saved'` 조건: 궁합에서 저장하지 않고 만든 즉석 상대(`temp`)는 목록에도 서지 않는다.
  "나"가 될 수 있으면 홈에 보이지도 않는 사람이 지도의 중심에 선다.

갱신된 행이 없으면 `false` 를 돌려 호출자가 404 로 접는다.

### `POST /api/profiles/[id]/primary`

본문 없는 요청이라 `DELETE /api/profiles/[id]` 와 같은 모양이다.

| 상황 | 상태 | 본문 |
|---|---|---|
| 세션 없음 | 401 | `{ error: "로그인이 필요합니다" }` |
| id 형식이 깨짐 (`parseProfileParam`) | 400 | `{ error: "요청을 확인해 주세요" }` |
| 없는 프로필 · 남의 프로필 · `temp` | 404 | `{ error: "프로필을 찾을 수 없습니다" }` |
| 정상 | 200 | `{ primary: true }` |

없는 것과 남의 것을 404 로 합치는 이유는 `handleDeleteProfile` 과 같다 — 401/404 를 가르면
id 를 올려가며 어느 번호가 존재하는지 훑을 수 있다.

### `home/page.tsx`

이미 `getUser(session.userId)` 를 부르고 있으므로 추가 쿼리 없이 `user.primaryProfileId` 를
`HomeIdentity` 에 넘긴다. 비로그인은 `null`.

### `HomeIdentity`

- 초기 `index` 는 넘겨받은 id 를 자기 `entries` 에서 찾아 잡는다. 못 찾으면 `0`.
  index 가 아니라 **id** 를 넘기는 이유: index 는 목록이 바뀌는 순간 다른 사람을 가리키는
  숫자가 되고, 서버와 클라가 같은 목록을 본다는 가정이 어디에도 적히지 않는다.
- 줄을 고르면 `setIndex` 와 함께 `POST /api/profiles/<id>/primary` 를 쏜다.
- **목록 순서는 안 건드린다.** 고른 것을 맨 위로 올리면 줄 위치가 매번 달라져 눈으로 외운
  자리를 다시 찾아야 한다. `created_at DESC` 그대로 두고 체크(✓)만 옮긴다.

## 가장자리

- **드래프트 줄**(`profileId === null`): 승격할 행이 없으니 아무것도 쏘지 않는다.
  비로그인은 목록이 한 줄이라 고를 일도 없다.
- **같은 줄 다시 고르기**: 요청을 쏘지 않는다.
- **실패**: 조용히 삼킨다. 토스트도, 되돌리기도 없다. 화면은 이미 넘어갔고 잃는 것은
  "다음 방문의 기본값" 하나뿐인데, 성공했을 때 아무 표시도 없는 동작에 실패할 때만
  빨간 줄을 띄우면 사용자는 자기가 무엇을 잘못했는지 찾게 된다.
- **삭제**: `primary` 를 지우면 FK 가 null 로 만든다(0029 의 `ON DELETE SET NULL`).
  화면은 다음 줄에 착지해 있는데 DB 는 null 이라 어긋난다 — `onDeleted` 에서 착지한 줄을
  한 번 더 승격시켜 맞춘다. 착지한 줄이 드래프트면(=아무것도 안 남았으면) 쏘지 않는다.
- **연타**: 빠르게 두 줄을 연달아 고르면 두 요청의 도착 순서가 뒤집힐 수 있다. abort 로는
  못 막고(서버는 이미 처리 중), 제대로 막으려면 요청 직렬화나 버전 번호가 필요하다.
  대가가 "다음 방문의 기본값이 한 칸 다름" 하나뿐이라 **막지 않고 받아들인다.**

## 테스트

vitest 환경이 `node` 라 클라이언트 컴포넌트는 렌더하지 못한다. 로직이 있는 두 곳을 덮는다.

- `src/app/api/profiles/[id]/primary/_lib/handler.test.ts`
  — 401 / 400 / 404(store 가 false) / 200 네 갈래.
- `src/lib/auth/users.test.ts` 에 `setPrimaryProfile` 추가
  — 가짜 sql client 로 소유자(`user_id`)와 `kind='saved'` 가 함께 걸리는지, 갱신된 행이
  없을 때 `false` 를 돌리는지.

## 하지 않는 것

- 새 컬럼 / 마이그레이션
- localStorage 기억 (승격이 아니라 화면 한 곳의 기억에 그쳐 지도·상담·궁합이 안 따라온다)
- 목록 재정렬
- 궁합 "나" 칸에서의 승격
- 리포트·상담 링크로 들어가는 것을 "선택"으로 세는 것
