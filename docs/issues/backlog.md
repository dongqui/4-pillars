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

**`/report` 실데이터 배선 때 처리**

- `reportHref`가 순번 bigint를 URL에 노출한다. `/report`가 이 id로 실제 조회를 시작하면 **반드시 `session.userId`로도 필터해야 한다** — id만으로 찾으면 쿼리 파라미터를 증가시켜 남의 생년월일을 읽을 수 있다.
- ~~섹션 수 모델이 두 벌이다.~~ 2026-08-02 해소. `environment`(화면 07)를 레지스트리에 넣어 총 13개(히어로 `overview` + 화면 01–12)가 됐고, 유료 8개가 잠금 목록 05–12와 1:1로 맞는다.

**UX 다듬기**

- 프로필 한도 초과(409)로 퍼널에서 `/home`으로 돌려보낼 때 아무 설명이 없다. `?error=limit` + 배너.
- 빈 상태에서 "0개 · 전체 리포트 0개" 캡션이 "아직 저장된 프로필이 없어요" 바로 위에 중복으로 뜬다.
- `AddProfileButton`의 비활성 상태가 `role` 없는 `div`라 보조기술에 전달되지 않는다.
- `ProfileRow.createdAt`이 `String(Date)`라 로케일 문자열이 된다. 지금은 아무도 읽지 않지만 첫 소비자가 걸린다.
- 랜딩에서 `/login`으로 가는 링크가 없다. `/home`이 로그인 후 행선이 된 지금, 로그인은 URL을 직접 쳐야만 들어갈 수 있다.

## 리포트 발행 흐름에 남은 고리

2026-08-03 현재 흐름 검토에서 나온 것. 목표 흐름은 **"무료 사용자가 리포트를 받는다 → 로그인하면 그 프로필이 저장된다 → 결제하면 유료 섹션만 추가로 생성해 합친다"** 인데, 뒤쪽(증분 생성·캐싱)은 이미 서 있고 앞쪽 두 고리가 비어 있다.

이미 되는 것(참고): `handleSaju`가 `missing` 섹션만 생성해 캐시분과 합치고, 캐시는 프로필·유저가 아니라 원국 단위(`chartKey` = 4기둥+성별, `luckKey` = +대운 기산값·기준 연도)로 잡힌다. 그래서 무료로 뽑아둔 섹션은 로그인·결제 여부와 무관하게 그대로 재사용된다.

**1. `/report` ↔ 생성 파이프라인 배선 — 설계 있음, 구현 전**

`POST /api/saju`는 완성돼 있지만 앱 어디서도 호출하지 않는다. `/report`는 `?profile`을 무시하고 `sampleReport` 픽스처만 렌더한다(`src/app/report/page.tsx`). 설계·계획 문서는 나와 있고 코드만 없다.

- 설계: `docs/superpowers/specs/2026-08-01-report-real-data-design.md`
- 계획: `docs/superpowers/plans/2026-08-01-report-real-data.md`
- 위 "`/report` 실데이터 배선 때 처리"의 `session.userId` 필터 항목이 이 작업에 딸려 있다.

**2. 익명 사용자의 입력값 보존 — 미설계. 여기가 실제 갈림길이다**

"무료 리포트 먼저, 로그인 나중" 순서를 지원하려면 이게 선행돼야 하는데, 위 설계 문서 §2가 익명 실데이터를 명시적으로 비범위로 뺐다(`?profile` 없으면 픽스처). 그래서 지금 코드의 순서는 **반대**다 — 퍼널 완료 시점에 *이미 로그인돼 있어야* `POST /api/profiles`로 저장되고, 비로그인이면 401을 받고 그냥 넘어간다(`src/app/funnel/page.tsx`, `src/app/api/profiles/_lib/handler.ts`).

막히는 지점 두 개:

- 퍼널 입력값이 `FunnelContext` 메모리에만 있다. 쿠키·localStorage 어디에도 안 남아서 `/report`로 넘어가는 순간 소실되고, 로그인 후 저장할 것이 남지 않는다.
- DB에 남는 건 해석 텍스트뿐이라 `chart_key`(4기둥+성별)로는 원국을 역산할 수 없다. 익명 리포트를 다시 그리려면 생년월일을 어딘가 새로 남겨야 한다.

결정할 것: 익명 입력을 어디에 남길지(서명 쿠키 / 임시 테이블+토큰), 로그인 시 그것을 프로필로 승격시키는 지점(OAuth 콜백 / `/report` 재방문), 익명 경로가 열리면 필요해지는 LLM 호출 레이트리밋.

**3. 결제 연동과 `sectionKeys` 확장**

유료 요청 경로 자체가 아직 없다.

- `src/app/api/saju/route.ts`가 `FREE_SECTION_KEYS`를 하드코딩한다(결제 전이라 의도된 상태). 유료는 `SECTION_KEYS` 전체를 넘기면 무료 5개는 캐시 히트로 빠지고 유료 8개만 LLM을 탄다 — 핸들러는 이미 그렇게 갈라진다.
- `/report`의 `isPaid`는 `?paid=true` 개발용 쿼리 토글이다(`src/app/report/_lib/access.ts`). 실제 판정은 `purchases` 조인(`listProfiles`)으로 옮겨야 한다.
- 유료 12섹션을 열면 `maxDuration = 60`을 다시 봐야 한다. `daeunOutlook`이 가장 느리다.
- 위 "결제 붙이기 전에 처리" 두 항목(`purchases` CASCADE, `purchases_paid_unique`)이 같이 걸린다.
