# 로그인 후 원래 가려던 곳으로 · 프로필 드롭다운 화살표

날짜: 2026-09-12
브랜치: `main`

전체 훑기에서 나온 다듬기 두 덩어리다. 서로 얽히지 않는다.

## 1. 프로필 드롭다운 화살표가 너무 작다

`PersonPicker`(상담의 "상담에 쓰는 사주", 흐름 선택의 `FlowConfirm`)는 화살표를 텍스트
문자 `▾` 로, `text-[11px]` 로 그린다. 같은 앱의 궁합 `PersonSelect` 는 16px SVG 셰브론을
쓴다 — 같은 모양의 드롭다운인데 화살표만 두 벌이고, 작은 쪽이 프로필 선택이다.

### 결정

16px SVG 셰브론 하나로 합친다. 궁합 쪽에 이미 있는 지역 함수 `Chevron` 을
`src/components/Chevron.tsx` 로 뽑아 두 곳이 같이 쓴다.

`PersonPicker` 만 키우고 끝내지 않는 이유: 그러면 "같은 드롭다운의 화살표가 두 벌"
이라는 원인이 그대로 남는다. 다음에 한쪽을 손보면 또 갈라진다.

`open` 일 때 180° 회전하는 동작은 양쪽이 이미 같으므로 그대로 옮긴다. 색(`text-slate-400`)도
양쪽이 같다.

## 2. 로그인 후 복귀

`?next=` 를 쿠키(`oauth_next`)로 넘겨 콜백이 읽는 길은 이미 있다. `/map` · `/flow` ·
`/consult` · `/match` · `/report` 의 로그인 요구도 모두 `next` 를 붙인다. 결제 복귀
(`/checkout?next=` → `checkout_next` 쿠키 → `/checkout/complete` → `/checkout/done?next=`)도
PC·모바일 양쪽이 이미 끝까지 물려 있다 — **이번 작업은 결제를 건드리지 않는다.**

구멍은 `next` 를 붙이지 않는 세 입구다.

### 2-1. 로그인 라우트의 기본값이 `/` 다

`api/auth/login/[provider]/route.ts` 가 `searchParams.get("next") ?? "/"` 로 읽는다.
그래서 **랜딩에서 로그인하면 랜딩으로 돌아온다.** `LandingNav` 의 주석은
"`/login` 의 기본 행선지가 이미 `/home` 이라 next 를 붙이지 않는다" 라고 적혀 있는데,
이 한 줄이 그 전제를 깨고 있었다.

`?? "/"` 를 없애고 `safeNext(...)` 를 통과시킨다. 값이 없으면 `DEFAULT_NEXT`(`/home`)로
접히므로 주석이 사실이 되고, `LandingNav` 는 건드릴 필요가 없다. 입구에서 한 번 더
검증하는 부수 효과도 있다 — 쿠키에 안전한 경로만 들어간다.

### 2-2. 헤더 메뉴의 "로그인" 이 맨손으로 간다

`AppMenu` 의 비로그인 갈래가 `/login` 으로만 보낸다. 현재 경로를 `next` 에 싣는다.

쿼리는 싣지 않는다 — 설계할 때는 `/report?profile=…` 을 잃을까 봐 `useSearchParams` 까지
쓰려 했지만, 구현하며 두 사실을 확인해 접었다.

1. `useSearchParams` 는 프리렌더되는 경로에서 **가장 가까운 Suspense 경계까지 클라이언트
   렌더로 내려간다**(Next 16 문서). `AppHeader` 는 홈·리포트·상담·궁합·흐름 다섯 화면이
   공유하므로, 지금은 전부 동적이라 해도 나중에 하나가 정적이 되면 헤더가 통째로 CSR 이 된다.
2. 애초에 잃을 쿼리가 없다. 이 메뉴의 비로그인 갈래가 보이는 화면은 드래프트 리포트뿐이고,
   `?profile=` 이 붙은 리포트는 비로그인이면 `report/page.tsx` 가 그 앞에서 로그인으로
   보낸다(그쪽은 서버에서 `?next` 에 id 를 직접 싣는다).

`AppMenu` 는 닫힌 상태에서 이 링크를 렌더하지 않는다(`{open && …}`). 그래서 href 를
마크업으로 검사할 수 없다 — `?next=` 를 붙이는 계산만 `lib/nav/next-param.ts` 의
`loginHref(path)` 로 뽑아 거기서 테스트한다. `?next` 해석이 이미 사는 모듈이다.

### 2-3. 리포트 생성 한도 화면

`ReportRateLimited` 의 "로그인하고 이어서 보기" 가 리포트로 돌아오지 않는다.
`/login?next=/report` 로 맞춘다 — 같은 화면의 `LockedSections` 가 쓰는 값과 같다.

이 상태에는 프로필 id 가 아직 없다. 그래도 괜찮은 이유: 로그인하는 순간 콜백의 드래프트
승격이 행선지를 `/report?profile=<새 id>` 로 덮는다.

## 테스트

- `lib/nav/next-param.test.ts` 에 `loginHref` 케이스를 더한다 — 쿼리 포함 경로가
  인코딩되는지, 이상한 값이 `DEFAULT_NEXT` 로 접히는지.
- `api/auth/login/[provider]/route.test.ts` 를 새로 만든다 — `next` 없이 들어왔을 때
  `oauth_next` 쿠키가 `/home` 인지, 외부 URL 이 와도 `/home` 으로 접히는지, 정상 내부
  경로는 그대로 실리는지.
- 화살표는 시각 변경이라 테스트 대신 dev 서버에서 실제 화면으로 확인한다.
