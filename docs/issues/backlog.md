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
- 로그인 상태 퍼널에서 로딩 화면이 두 번 나온다. 퍼널의 `AnalyzingScreen`(최소 2.2초, "만세력 환산 · 오행 분석 중", `src/app/funnel/page.tsx`) → `/report?profile=<id>` → `AnalyzingReport`("리포트를 쓰고 있어요", LLM 생성이 끝날 때까지, `src/app/report/_components/AnalyzingReport.tsx`). 문구는 각각 정확하지만 사용자에겐 스피너가 두 번이다. 퍼널의 최소 노출 시간을 이 갈래에서만 걷어내는 것을 검토.

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
- 남은 것: 익명 LLM 호출 레이트리밋. 아래 3번과 §1이 익명 생성 경로를 열 때 필요해진다. GET `/report`가 이제 생성 진입점이 됐다는 점도 같이 걸린다 — POST였던 퍼널 제출은 한 번뿐이었지만 GET 페이지는 새로고침·뒤로가기·재시도·복수 탭이 전부 트리거고, 같은 원국이 캐시 미스인 동안 in-flight 중복을 막을 장치가 없어(`src/app/report/page.tsx` → `produceSections`) 각각 온전한 생성이 돈다. 서버리스에서 응답이 끊기면 LLM 비용은 나가고 캐시는 못 채우는 조합도 가능하다.

**3. 결제 연동과 `sectionKeys` 확장**

유료 요청 경로 자체가 아직 없다.

- `src/app/api/saju/route.ts`가 `FREE_SECTION_KEYS`를 하드코딩한다(결제 전이라 의도된 상태). 유료는 `SECTION_KEYS` 전체를 넘기면 무료 4개는 캐시 히트로 빠지고 유료 8개만 LLM을 탄다 — 핸들러는 이미 그렇게 갈라진다.
- `/report`의 `getReportAccess().isPaid`는 여전히 `?paid=true` 개발용 쿼리 토글이지만(`src/app/report/_lib/access.ts`), 이제 `NODE_ENV !== "production"`으로 감싸 프로덕션에서는 무시된다 — 픽스처만 있던 시절과 달리 지금은 붙이면 DeepSeek로 유료 8섹션을 실제 생성하고, 그 결과가 원국 단위 공유 캐시에 영구 저장돼 결제가 붙은 뒤에도 그 원국은 공짜가 되는 경로였기 때문이다. 프로필이 있는 요청은 `access.isPaid || profile.isPaid`로 OR해(`src/app/report/page.tsx`) `getProfile`의 `purchases` 조인 결과도 함께 읽는다(`src/lib/profiles/store.ts`). 남은 것: 실제 결제 요청 경로 — `purchases`에 행을 넣는 코드가 아직 없어 `profile.isPaid`는 항상 false다.
- 유료 12섹션을 열면 `maxDuration = 60`을 다시 봐야 한다. `daeunOutlook`이 가장 느리다.
- 위 "결제 붙이기 전에 처리" 두 항목(`purchases` CASCADE, `purchases_paid_unique`)이 같이 걸린다.

**4. 유료인데 섹션이 빠지면 화면에 신호가 없다**

`ReportBody`(`src/app/report/_components/ReportBody.tsx`)는 유료 갈래에서 `content.emotion && <EmotionSection/>` 식으로 섹션마다 존재 여부만 본다. `PromptedGenerator`(`src/app/api/saju/_lib/prompted.ts`)가 섹션별 생성 실패를 삼키고 나머지로 넘어가므로 이건 예외가 아니라 정상 경로고, `daeunOutlook`이 `maxDuration = 60`을 넘길 수 있다고 `page.tsx` 주석 자체가 인정한다. 그래서 유료 프로필의 한 섹션이 빠지면 잠금 카드도 에러도 없이 리포트가 04에서 그냥 끝나는데, 같은 순간 `/home` 카드는 `isPaid`만 보고 "전체 리포트"를 표시한다(`src/app/home/_lib/to-profile-card.ts`). 설계 §7의 "`overview`만 있으면 있는 것만 렌더" 규칙은 무료 4섹션 시절에 정한 것이라, 유료 화면에서 빠진 섹션을 사용자에게 알리는 문제는 아직 다루지 않는다.

**5. `/report` 배선 자체에 테스트가 없다**

조각들(`parseProfileParam`, `getProfile`, `toBirthInput`, `toReportMeta`, `produceSections`)은 각각 테스트가 있지만, 그것들을 잇는 `page.tsx`의 결정은 테스트되지 않는다: `sectionKeys` 선택(틀리면 조용히 유료 8섹션어치 LLM 비용이 나간다), absent/invalid/세션 없음 세 갈래, 리다이렉트 타깃, `overview` 부재 → `ReportError`. 리포 전체에 `*.test.tsx`가 하나도 없어(서버 컴포넌트 테스트 인프라 부재) 관행에는 맞는다. 최소한 `sectionKeys` 결정만이라도 순수 함수로 뽑으면 테스트할 수 있다.

**6. `src/app/api/saju/_lib`가 이제 두 진입점의 공용 코어다**

`/report/page.tsx`가 거기서 `generator`·`produce`·`store`·`store-luck`·`sections`·`types` 6개 모듈을 import한다. `_lib`는 관례상 "라우트 전용"을 뜻해 소유권이 흐려 보인다. `src/lib/saju/generation/` 같은 자리로 옮기는 것을 검토.

**7. 퍼널과 리포트의 `toBirthInput`이 같은 프로필에 다른 경도를 줄 수 있다**

퍼널의 `resolveLongitude`(`src/lib/regions.ts`)는 지역을 못 찾으면 국가 기본값(KR 서울 126.98 / JP 도쿄 139.69)으로 물러서는데, 리포트의 `toBirthInput`(`src/app/report/_lib/to-birth-input.ts`)은 지역을 못 찾으면 `longitude`를 아예 넘기지 않아 saju-core 기본값 127(서울 근사치)이 쓰인다. 지금은 `getLocale()`이 `"ko"` 고정(`src/app/funnel/_lib/locale.ts`)이라 퍼널이 저장하는 프로필은 항상 KR·유효한 regionId뿐이라 드러나지 않지만, region 목록이 개정돼 저장된 regionId가 빠지거나 JP 로케일이 열리면 `{country:"JP", regionId:<사라진 id>}` 같은 프로필에서 리포트가 도쿄가 아니라 서울 경도로 계산해 시주가 틀어질 수 있다.

**8. `not-found.tsx`가 없어 `notFound()`가 Next 기본 영문 404로 떨어진다**

이번 작업이 처음으로 `notFound()`를 사용자가 실제로 도달할 수 있는 자리(`/report?profile=` 형식 오류·없는 프로필·남의 프로필)에 놓았다. 오래된 북마크나 다른 계정으로 로그인해 들어온 평범한 경로에서 헤더 없는 `404 | This page could not be found.`가 나온다.

**9. 코드 품질 소소한 것들**

- `getProfile`의 `is_paid` LEFT JOIN이 `listProfiles`와 SQL이 그대로 중복된다(`src/lib/profiles/store.ts`) — 세 번째 호출자가 생기면 SQL 조각으로 뽑는다.
- 502 응답 문구 `"해석 생성에 실패했습니다"`가 HTTP를 모르는 `produce.ts`의 `GenerationError` 생성자에 산다(`src/app/api/saju/_lib/produce.ts`) — `handler.ts`가 `e.message`를 그대로 응답에 싣는다. `GenerationError`엔 코드만 붙이고 문구는 호출자로 옮기는 편이 낫다.
- `ReportError`의 "잠시 뒤 다시 시도"(`src/app/report/_components/ReportError.tsx`)가 원국 계산(`analyze`) 실패 갈래엔 안 맞는다 — 그 실패는 결정적이라 재시도해도 같은 결과다.
- `page.tsx`의 `let analysis;`가 명시 타입 없이 추론에 기댄다.
- `produce.test.ts`가 검증-드롭 경로(스키마 불통과 섹션)와 저장 페이로드를 직접 검사하지 않는다 — `handler.test.ts`가 지금은 같은 경로를 덮지만, `handleSaju`가 더 얇아지면 새는 자리가 된다.
- `access.test.ts`의 `?paid=true` 두 케이스가 앰비언트 `NODE_ENV`에 기댄다 — `vi.stubEnv("NODE_ENV", "development")`로 명시하면 CI가 `NODE_ENV=production`을 내보낼 때도 오해할 여지가 없다.

**10. `overview`가 무관용(zero-tolerance) 스키마다**

`overview`는 이제 `.length(4)`인 `traits` 배열에 `headline`·`summary`까지 한 번의 tool 호출로 모두 담아야 통과한다. 옛 `overview`는 `keywords`가 3~6개 범위였어서 개수가 조금 흔들려도 통과했는데, 지금은 정확히 4개가 아니면(trait 하나만 필드가 비어도) 객체 전체가 실패한다. 실패는 `produce.ts`에서 `console.warn`만 하고 조용히 넘어가고, `page.tsx`는 `overview`가 없으면 리포트 전체를 `ReportError`로 떨어뜨린다 — 성향 카드 하나의 흠이 리포트 전체를 막는 경로다. 흔들림이 실제로 관측되면 두 방향을 검토: `.min(3).max(4)`로 완화(히어로 그리드도 01 카드 목록도 3개까지는 레이아웃이 버틴다), 또는 사용자에게 보이는 신호 추가. 위 4번 항목(유료 섹션 누락에 신호가 없다)과 같은 종류의 문제다.

**11. `registry.ts`의 `overview.example`이 trait 을 1개만 보여준다**

다른 섹션들(`strengths`, `emotion` 등)도 예시에 min 미만의 조각만 보이는 관례를 따르지만, 그 관례는 범위 제약(`min`~`max`)을 위해 정한 것이다. `overview`는 개수가 정확히 4개로 고정돼 있고 하나라도 부족하면 위 10번처럼 섹션 전체가 실패하는 유일한 자리라, 예시가 "몇 개를 보여줄지"가 아니라 "정확히 몇 개가 필요한지"를 흐릴 수 있다. 예시를 4개로 채우는 게 나을지는 실제 생성 결과에서 개수 누락이 보이면 다시 본다.
