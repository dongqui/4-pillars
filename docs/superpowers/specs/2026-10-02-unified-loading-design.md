# 로딩 UI 통일 · CTA 커서 정리

날짜: 2026-10-02

## 문제

- 오래 걸리는 CTA(리포트 전체 보기, 상담 시작, 궁합 보기, 흐름 리포트 만들기)를 누르면 버튼만 비활성화되고 문구가 바뀐다. 대기가 10~60초라 버튼 상태로는 맞지 않는다.
- 로딩 화면이 제각각이다: `CharacterLoading`(다크), `AnalyzingReport`, 이를 복붙한 `AnalyzingMatch`·`AnalyzingFlow`, 인라인 스피너. 공용 컴포넌트가 없다.
- 비활성 스타일도 `opacity-60` / `opacity-40` / 회색 배경 등으로 다르다.
- Tailwind v4 가 `<button>` 커서를 기본값으로 둬서 `cursor-pointer` 가 빠진 버튼이 30개 가까이 된다.

## 결정

### 1. `LoadingScreen` 컴포넌트 — `src/components/loading/`

- props: `title`, `steps: string[]`, `tips?: string[]`, `variant: 'page' | 'overlay'`.
  - `page`: 페이지 본문 자리를 채운다 (Suspense fallback 용).
  - `overlay`: `fixed inset-0` 흰 배경으로 화면 전체를 덮는다 (클릭 직후 용).
- 진행 바는 서버 진행률이 없으므로 **시간 기반 추정치**다. 처음엔 빠르고 점점 느려지는 곡선이며 **92% 에서 멈춘다**. 완료 전에 100% 를 보여 주지 않는다.
- 단계는 진행률 구간에 맞춰 넘어간다(완료 ✓ / 진행 중 ● / 대기 ○). 팁은 4~5초마다 바뀐다.
- 시안 `design/project/Saju Report Loading.dc.html` 의 구성(단계 카드, 진행 바, 팁)을 따르되 색은 앱 accent(파랑 `#2563eb`), 글꼴은 Pretendard.
- 새 애니메이션 클래스는 `globals.css` 의 `prefers-reduced-motion` 목록에 넣는다.
- `role="status"` + `aria-live="polite"`.
- 화면별 문구는 `presets.ts` 한 곳에 모은다:
  - report: 만세력 변환 → 여덟 글자 세우기 → 오행·십신 살피기 → 해석문 작성 → 마무리
  - match: 두 사람 사주 세우기 → 오행 궁합 살피기 → 관계 해석 작성 → 마무리
  - flow: 대운·세운 살피기 → 월별 흐름 짚기 → 해석문 작성 → 마무리
  - consult: 사주 읽기 → 고민 정리 → 첫 답변 작성

### 2. 적용

| 화면 | 변경 |
|---|---|
| `/report`, `/match/[id]`, `/flow/[id]` | Suspense fallback 을 `LoadingScreen variant="page"` 로 교체. `AnalyzingReport`·`AnalyzingMatch`·`AnalyzingFlow` 삭제. `AnalyzingRestOfMatch`(부분 생성 시 작은 인라인 스피너)는 유지. 흐름 v2 의 상황별 메시지는 `title` 로 넘긴다. |
| 리포트 전체 보기 (`use-unlock`) | 이용권 차감 성공 직후 overlay 를 띄우고 `router.refresh()`. 새 RSC 가 반영돼 잠금이 풀리면(컴포넌트 언마운트) 사라진다. 402/401 리다이렉트 경로에서는 띄우지 않는다. |
| 상담 시작 (`ConsultBoard`) | 클릭 즉시 overlay. `/consult/[id]` 로 이동하면 사라진다. 실패 시 overlay 를 닫고 기존 오류 안내. API 는 바꾸지 않는다. |
| 궁합 보기 (`MatchForm`), 흐름 리포트 만들기 (`FlowConfirm` PayModal, `SituationSheet`) | 클릭 즉시 overlay. 도착 페이지 fallback 이 같은 컴포넌트라 이어져 보인다. 402 → checkout 등 리다이렉트·오류 경로에서는 overlay 를 닫는다. |
| 결제, 상담 채팅 전송, 저장·삭제 등 짧은 버튼 | 버튼 로딩 유지. 비활성 스타일을 `disabled:opacity-50` 으로 통일. |

함께 고치는 버그: `MatchForm.submit` 은 fetch 가 throw 하면 `pending` 이 풀리지 않아 버튼이(이제는 overlay 가) 영원히 남는다. try/catch 로 오류 경로에서 해제한다.

### 3. 커서

`globals.css` 에 전역 규칙:

```css
button:not(:disabled), [role="button"], summary, label[for] { cursor: pointer; }
button:disabled { cursor: not-allowed; }
```

개별 버튼에 클래스를 붙이지 않는다(다음 버튼에서 또 빠진다). 의도적으로 다른 커서를 지정한 곳(`SocialLoginButton` 의 `cursor-default` 등)과 `Button.tsx` 의 `disabled:cursor-default` 는 확인해 규칙과 맞춘다.

## 범위 밖

- 퍼널 `CalculatingScreen`(CharacterLoading)과 Reveal — LLM 대기가 아니라 연출이다. 그대로 둔다.
- 상담 API 를 "행 먼저 만들고 채팅방에서 생성" 구조로 바꾸는 것.
- 서버의 실제 진행률 전달.

## 검증

- `tsc --noEmit`, lint 통과.
- dev 서버에서 리포트 첫 진입 / 전체 보기, 궁합 생성, 흐름 생성, 상담 시작 각각 로딩 화면이 뜨고 완료 후 사라지는지.
- 버튼 hover 시 pointer, 비활성 시 not-allowed.
