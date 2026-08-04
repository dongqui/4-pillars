# 향후 확장 (백로그)

- 궁합 서비스
- AI 상담
- 오늘의 운세 / 월운 / 세운
- 대운 리포트
- 가족 사주 관리
- 구독 모델

## /home 프로필 화면에서 미룬 것

2026-07-31 `feat/home-profiles` 최종 리뷰에서 나왔지만 이번 범위 밖으로 둔 항목들.

**결제 붙이기 전에 처리**

- `purchases.profile_id`가 `ON DELETE CASCADE`다. 프로필 삭제가 생기면 결제 내역이 같이 지워진다 — 환불·분쟁·회계 때문에 결제 기록은 대상보다 오래 살아야 한다. `ON DELETE SET NULL`로 바꾸는 새 마이그레이션이 필요하다 (0007을 고치면 이미 적용된 DB에는 반영되지 않는다).
- `purchases_paid_unique`는 `profile_id IS NULL` 행을 제약하지 못한다 (SQL은 NULL을 서로 다르게 본다). 프로필 단위가 아닌 상품(구독 등)은 `(user_id, product)` 기준 제약을 따로 걸어야 한다.

**~~`/report` 실데이터 배선 때 처리~~ — 2026-08-04 해소**

`getProfile(userId, id)`가 `user_id`로 함께 필터해(`src/lib/profiles/store.ts`) id만으로는 남의 프로필을 조회할 수 없고, `parseProfileParam`이 `?profile`을 `/^\d+$/`로 검증해(`src/app/report/_lib/access.ts`) 형식이 다른 값은 DB에 닿기 전에 걸러낸다. 없는 프로필과 남의 프로필을 구분하지 않고 둘 다 `notFound()`.

- ~~섹션 수 모델이 두 벌이다.~~ 2026-08-02 해소. `environment`(화면 07)를 레지스트리에 넣어 총 13개(히어로 `overview` + 화면 01–12)가 됐고, 유료 8개가 잠금 목록 05–12와 1:1로 맞는다.

**UX 다듬기**

- 빈 상태에서 "0개 · 전체 리포트 0개" 캡션이 "아직 저장된 프로필이 없어요" 바로 위에 중복으로 뜬다.
- `AddProfileButton`의 비활성 상태가 `role` 없는 `div`라 보조기술에 전달되지 않는다.
- `ProfileRow.createdAt`이 `String(Date)`라 로케일 문자열이 된다. 지금은 아무도 읽지 않지만 첫 소비자가 걸린다.
- 랜딩에서 `/login`으로 가는 링크가 없다. `/home`이 로그인 후 행선이 된 지금, 로그인은 URL을 직접 쳐야만 들어갈 수 있다.

## 리포트 발행 흐름에 남은 고리

2026-08-03 현재 흐름 검토에서 나온 것. 목표 흐름은 **"무료 사용자가 리포트를 받는다 → 로그인하면 그 프로필이 저장된다 → 결제하면 유료 섹션만 추가로 생성해 합친다"** 인데, 뒤쪽(증분 생성·캐싱)은 이미 서 있고 앞쪽 두 고리가 비어 있다.

이미 되는 것(참고): `handleSaju`가 `missing` 섹션만 생성해 캐시분과 합치고, 캐시는 프로필·유저가 아니라 원국 단위(`chartKey` = 4기둥+성별, `luckKey` = +대운 기산값·기준 연도)로 잡힌다. 그래서 무료로 뽑아둔 섹션은 로그인·결제 여부와 무관하게 그대로 재사용된다.

**1. ~~`/report` ↔ 생성 파이프라인 배선~~ — 2026-08-04 해소**

`/report`가 `?profile=<id>`를 실제 조회로 이어 원국을 계산하고(`analyze`), `produceSections`로 해석을 생성·캐시해 렌더한다(`src/app/report/page.tsx`). 셸을 먼저 보내고 본문은 `<Suspense>`로 스트리밍한다.

- 설계: `docs/superpowers/specs/2026-08-01-report-real-data-design.md`
- 계획: `docs/superpowers/plans/2026-08-01-report-real-data.md`
- ~~콜백은 승격 후 `/home?saved=1`로 보낸다~~ — 2026-08-04 해소. `/report?profile=<id>`가 실데이터를 렌더하게 됐으므로 승격 갈래의 행선지를 리포트로 옮겼다(`src/app/api/auth/callbacks/[provider]/route.ts`). 남은 것: §3(결제)이 붙으면 이 갈래를 체크아웃으로 옮긴다.

**2. ~~익명 사용자의 입력값 보존~~ — 2026-08-04 해소**

`POST /api/profiles`가 세션 유무로 갈린다 — 없으면 Upstash Redis 드래프트 + `draft` 쿠키(202), OAuth 콜백이 그 손잡이로 프로필을 만들고 `/report?profile=<id>`로 보낸다(2026-08-04 §1 해소로 리포트가 실데이터를 렌더하게 되면서 행선지가 `/home?saved=1`에서 옮겨왔다). `/report`의 "전체 결과 보기"가 비로그인일 때 `/login?next=/report`로 가는 입구다.

- 설계: `docs/superpowers/specs/2026-08-04-anonymous-draft-design.md`
- 남은 것: 익명 LLM 호출 레이트리밋. 아래 3번과 §1이 익명 생성 경로를 열 때 필요해진다.

**3. 결제 연동과 `sectionKeys` 확장**

유료 요청 경로 자체가 아직 없다.

- `src/app/api/saju/route.ts`가 `FREE_SECTION_KEYS`를 하드코딩한다(결제 전이라 의도된 상태). 유료는 `SECTION_KEYS` 전체를 넘기면 무료 5개는 캐시 히트로 빠지고 유료 8개만 LLM을 탄다 — 핸들러는 이미 그렇게 갈라진다.
- `/report`의 `getReportAccess().isPaid`는 여전히 `?paid=true` 개발용 쿼리 토글이지만(`src/app/report/_lib/access.ts`), 프로필이 있는 요청은 `access.isPaid || profile.isPaid`로 OR해(`src/app/report/page.tsx`) `getProfile`의 `purchases` 조인 결과도 함께 읽는다(`src/lib/profiles/store.ts`). 남은 것: 실제 결제 요청 경로 — `purchases`에 행을 넣는 코드가 아직 없어 `profile.isPaid`는 항상 false다.
- 유료 12섹션을 열면 `maxDuration = 60`을 다시 봐야 한다. `daeunOutlook`이 가장 느리다.
- 위 "결제 붙이기 전에 처리" 두 항목(`purchases` CASCADE, `purchases_paid_unique`)이 같이 걸린다.
