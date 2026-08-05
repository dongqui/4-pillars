# 결제 페이지 (`/checkout`) 설계 문서

**날짜:** 2026-08-05
**디자인 출처:** Claude Design 프로젝트 `사주` — `Saju Checkout KR.dc.html`. 로컬 사본: `design/project/`.

## 1. 목표

리포트의 잠긴 8섹션을 사려는 사용자가 보는 결제 화면을 만든다. 지금 `LockedSections`의 CTA는 `href="#"`로 끊겨 있어 로그인한 사용자가 갈 곳이 없다 — 그 끝을 잇는다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 깊이 | **화면만.** PG 연동(ISSUE-014)은 다음 작업. |
| 로케일 | **KR만.** `getLocale()`이 `"ko"` 고정이고 다른 화면도 전부 한국어 하드코딩이라 결로를 맞춘다. `Saju Checkout JP`는 나중에. |
| 결제하기 버튼 | **활성 상태로 두되 누르면 아무 일도 하지 않는다.** `disabled`는 약관 동의 여부에만 걸린다. PG 호출 자리는 주석으로 표시. |
| 금액 | **상수 하나로 고정.** 정가 ₩19,900 / 첫 리포트 할인 −₩10,000 / 최종 ₩9,900. |
| accent 색 | **기존 토큰 유지** (`--color-accent` = `#2563eb`). 목업의 인디고 `#4F46E5`는 따르지 않는다 — `Saju Design System.dc.html`도 `#2563EB`고, 로그인·리포트와 색이 튀면 안 된다. (`2026-07-31-home-profiles-design.md`와 같은 판단.) |

### 비범위 (YAGNI)

- PortOne/KG이니시스 SDK, 결제창 호출, `purchases` 행 생성, 웹훅, 결제 결과 페이지.
- 첫 구매 여부에 따른 할인 분기. 결제가 없으니 모든 사용자가 늘 첫 구매다 — 조건문이 상수와 같은 값만 낸다.
- 영수증 이메일 입력. JP 목업에만 있는 카드다.
- 로케일 분기·i18n 배선.

## 3. 라우트와 가드

`src/app/checkout/page.tsx` (신규). 서버 컴포넌트. `/report`와 같은 순서로 막는다.

| 상황 | 처리 |
| --- | --- |
| `?profile` 없음 | `notFound()` |
| `?profile` 형식 오류 | `notFound()` |
| 비로그인 | `redirect("/login?next=/checkout?profile=<id>")` |
| 없는 프로필 / 남의 프로필 | `notFound()` — `getProfile`이 `user_id`로 이미 구분 없이 막는다 |
| 이미 결제한 프로필 (`isPaid`) | `redirect("/report?profile=<id>")` |

`/report`는 `?profile` 없음을 픽스처 데모로 떨어뜨리지만 `/checkout`은 `notFound()`다 — 결제 대상이 없는 결제 화면은 보여줄 것이 없고, 데모로 떨어뜨리면 사용자는 자기가 산 것이 무엇인지 오해한다.

### `parseProfileParam` 이동

지금 `src/app/report/_lib/access.ts`에 있다. 결제 라우트가 리포트 라우트 내부 `_lib`을 import하면 두 기능이 파일 하나로 묶인다. `src/lib/profiles/param.ts`로 옮기고 `access.ts`는 거기서 re-export한다 — 기존 import 경로와 테스트가 그대로 통과한다.

| 파일 | 변경 |
| --- | --- |
| `src/lib/profiles/param.ts` (신규) | `SearchParams`, `first`, `ProfileParam`, `parseProfileParam` |
| `src/lib/profiles/param.test.ts` (신규) | `access.test.ts`의 `parseProfileParam` describe 블록을 그대로 옮긴다 |
| `src/app/report/_lib/access.ts` | `first`를 import해 쓰고, `ProfileParam`/`parseProfileParam`을 re-export |
| `src/app/report/_lib/access.test.ts` | 옮긴 describe 블록 제거 (`getReportAccess`만 남는다) |

## 4. 화면 구성

```
src/app/checkout/page.tsx                       서버: 가드 + 프로필 조회
src/app/checkout/_components/CheckoutHeader.tsx 사 로고 + "안전 결제"
src/app/checkout/_components/CheckoutView.tsx   "use client": method/agreed 상태 소유
src/app/checkout/_components/PaymentMethodList.tsx
src/app/checkout/_components/OrderSummary.tsx
src/app/checkout/_components/StickyPayBar.tsx
src/app/checkout/_lib/methods.ts                결제수단 3종 + 선택별 안내문
src/app/checkout/_lib/pricing.ts                금액 상수 + ₩ 포맷
src/app/checkout/_lib/to-order.ts               ProfileRow → 주문 요약 표시값
```

상태(`method`, `agreed`)는 `CheckoutView` 하나가 갖는다. `OrderSummary`와 `StickyPayBar`가 같은 `agreed`를 봐야 하고, 안내문이 `method`를 따라가기 때문이다. 나머지는 props만 받는 표시 컴포넌트다.

### 반응형

디자인은 `window.innerWidth`로 분기하지만 그대로 옮기지 않는다 — SSR 첫 페인트가 데스크톱으로 나왔다 마운트 후 튄다. CSS 미디어쿼리로 대체하되 브레이크포인트는 같게 둔다.

| 디자인 | 구현 |
| --- | --- |
| `w < 900` → 1단 그리드 | `min-[900px]:grid-cols-[minmax(0,1fr)_348px]` |
| `w < 640` → 스티키 바, 인라인 버튼 숨김 | 인라인 버튼 `hidden sm:block`, 스티키 바 `sm:hidden` |

## 5. 데이터

- **금액**: `_lib/pricing.ts`의 `FULL_REPORT_PRICE = { list: 19900, discount: 10000, total: 9900 }` + `formatKrw`. 화면은 읽기만 한다. PG가 붙을 때 서버가 같은 상수를 쓴다.
- **주문 대상**: `ProfileRow` → `toOrderItem`. 아바타 이니셜은 이름 첫 글자, 부제는 `이정숙 (1963.04.12)`.
  - 디자인의 `어머니 · 이정숙`에서 **관계는 뺀다** — `profiles`에 관계 컬럼이 없다. (`2026-07-31-home-profiles-design.md`에서 관계 칩을 제거한 것과 같은 이유.)

## 6. 리포트 연결

| 파일 | 변경 |
| --- | --- |
| `src/app/report/page.tsx` | `ReportBody`에 `profileId={profile.id}` 전달 |
| `src/app/report/_components/ReportBody.tsx` | `profileId?: string`를 받아 `LockedSections`로 내린다 |
| `src/app/report/_components/LockedSections.tsx` | 로그인 + `profileId` 있으면 CTA `href`가 `/checkout?profile=<id>` |

픽스처 데모(`?profile` 없음)는 `profileId`가 없어 지금 동작(`href="#"`) 그대로다. 데모 방문자를 퍼널로 보내는 것은 별건이다.

## 7. 테스트

`vitest`, 순수 함수만. 테스팅 라이브러리는 지금 없고 이번에 추가하지 않는다.

- `pricing.test.ts` — `formatKrw` 자릿수 구분, 할인 표기
- `to-order.test.ts` — 이니셜, 생년월일 0 패딩
- `param.test.ts` — 옮겨온 `parseProfileParam` 케이스

컴포넌트와 페이지 가드는 테스트하지 않는다. `page.tsx`의 가드는 `/report`와 같은 형태이고, 그쪽도 테스트가 없다 — 결제가 실제로 붙어 판정에 값이 실릴 때 함께 잡는 편이 낫다.
