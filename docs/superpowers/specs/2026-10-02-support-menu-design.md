# 고객 문의 메뉴 (오류 문의 · 피드백 · 환불 요청)

날짜: 2026-10-02
시안: Claude Design `사주` 프로젝트 `Saju Home.dc.html` (오른쪽 위 ⋯ 메뉴, 문의 모달)

## 문제

- 사용자가 오류·불만·환불을 알릴 길이 푸터의 `mailto:` 하나뿐이다. 어떤 해석·결제 건인지 알 수 없는 메일이 온다.
- 시안은 ⋯ 메뉴에 세 항목과 모달을 그렸다. 시안의 환불 목록은 "궁합 · 1,000원"처럼 해석 단위인데, 실제 결제 단위는 이용권 묶음(`purchases`: t1/t5/t10)이고 해석은 이용권 사용(`entitlements`)이라 그대로 옮길 수 없다.
- 나중에 어드민 페이지를 만든다. 문의는 메일에만 있으면 안 되고 DB 에 남아야 한다.

## 결정

### 1. 메뉴 — `src/components/AppMenu.tsx`

- 기존 메뉴에 **오류 문의 / 피드백 보내기 / 환불 요청** 세 항목을 **추가만** 한다. 시안에서 빠진 이름·로그아웃은 남긴다.
- 로그인 상태에서만 보인다. 문의를 사용자에게 묶어야 답장 주소와 이용 내역을 붙일 수 있다.
- `AppHeader` 를 쓰는 모든 화면에 함께 붙는다.

### 2. 모달 — `SupportDialog`

- 한 컴포넌트가 `kind: 'error' | 'feedback' | 'refund'` 로 문구·필드를 바꾼다. 문구는 시안 그대로:

| kind | 제목 | 선택 목록 | 칩 | 텍스트 | 보내기 조건 | 완료 문구 |
|---|---|---|---|---|---|---|
| error | 오류 문의 | 문제가 생긴 서비스 (+ 기타) | — | 자세한 설명 (필수) | 항목 + 텍스트 | 문의가 접수되었어요 / 확인 후 가입하신 이메일로 답변드릴게요. |
| feedback | 피드백 보내기 | — | — | 내용 (필수) | 텍스트 | 피드백 고마워요 / 보내주신 의견은 서비스 개선에 참고할게요. |
| refund | 환불 요청 | 결제 내역 | 환불 사유: 실수로 결제했어요 · 결과가 나오지 않아요 · 내용이 기대와 달라요 · 기타 | 추가 설명 (선택) | 결제 건 + 사유 | 환불 요청이 접수되었어요 / 영업일 기준 3일 안에 처리 결과를 알려드릴게요. |

- native `<dialog>.showModal()` (`LeaveConfirmDialog` 와 같은 방식 — top layer, 포커스 가두기, Esc).
- 760px 미만은 하단 시트(위쪽만 둥근 모서리), 이상은 가운데 카드(최대 460px).
- 목록은 모달이 열릴 때 `GET /api/support/options?kind=error|refund` 로 받는다. 받는 동안 목록 자리에 짧은 스켈레톤, 실패 시 "목록을 불러오지 못했어요" + 다시 시도.
- 전송 중엔 보내기 버튼 비활성(`disabled:opacity-50`), 실패 시 모달 안에 오류 문구. 성공 시 ✓ 완료 화면 → 확인으로 닫는다.

### 3. 목록 데이터 — `src/lib/support/options.ts`

**오류 문의 — 이용한 서비스**: 최근 순, 최대 30개, 맨 끝에 "기타 · 목록에 없는 문제예요".

| 출처 | 제목 | 부제 | target |
|---|---|---|---|
| `entitlements` feature=full_report | 리포트 | 프로필 이름 | `full_report` / subject_key |
| `entitlements` feature=compatibility | 궁합 | A × B (matches 조인) | `compatibility` / subject_key |
| `entitlements` feature=consultation | 상담 | 상담 제목 | `consultation` / subject_key |
| `entitlements` feature=yearly_flow | {연도} 한 해의 흐름 | 프로필 이름 | `yearly_flow` / subject_key |
| `maps` (owner_user_id) | 관계 지도 | 중심 인물 이름 | `map` / map id |
| — | 기타 | 목록에 없는 문제예요 | `other` / null |

- 메타는 날짜("오늘", "어제", 그 외 "M월 D일"). 프로필 등이 지워져 이름을 못 찾으면 부제는 "삭제된 항목".
- yearly_flow 의 subject_key 형태는 구현 계획에서 `spend` 호출부를 보고 조인 방법을 정한다.

**환불 — 결제 내역**: `purchases` 중 `status='paid'`, 최근 순.

- 제목 "이용권 N장" — N 은 보너스를 포함한 적립 장수(`purchases.tickets`)로, 카드 명세서의 주문명(`packageOrderName`)과 같은 문구다. 부제 "5,000원", 메타 결제일.
- 목록 위에 "지금 남은 이용권 N장" 한 줄 (`getBalance`). 지갑이 계정 하나로 합쳐져 있어 결제 건별 잔여는 계산할 근거가 없다.
- 결제 건이 없으면 "환불할 결제 내역이 없어요" 를 보여 주고 보내기를 막는다.
- 이미 열린(`status='open'`) 환불 요청이 있는 결제 건은 메타에 "요청됨" 을 붙이고 고를 수 없게 한다.

### 4. 저장 — 마이그레이션 `support_tickets`

```
id            bigint identity PK
user_id       bigint NOT NULL → users ON DELETE CASCADE
kind          text NOT NULL CHECK IN ('error','feedback','refund')
target_kind   text NULL CHECK IN ('full_report','compatibility','consultation','yearly_flow','map','other')
target_ref    text NULL
target_label  text NULL      -- 보낸 시점의 "궁합 · 동진 × 민수" 박제
purchase_id   bigint NULL → purchases ON DELETE CASCADE
refund_reason text NULL
body          text NOT NULL DEFAULT ''   -- 4000자 상한은 zod
reply_email   text NULL      -- 보낸 시점의 users.email (카카오 등은 없을 수 있다)
status        text NOT NULL DEFAULT 'open' CHECK IN ('open','resolved')
admin_note    text NULL
resolved_at   timestamptz NULL
created_at    timestamptz NOT NULL DEFAULT now()
```

- kind 별 필수값을 CHECK 로 묶는다: `kind <> 'error' OR target_kind IS NOT NULL`, `kind <> 'refund' OR (purchase_id IS NOT NULL AND refund_reason IS NOT NULL)`.
- 그래서 `purchase_id` 는 `ON DELETE CASCADE` 다. 결제 행이 지워지는 건 사용자째 지워질 때뿐이고, 결제 없는 환불 요청은 뜻이 없다. SET NULL 이면 위 CHECK 와 부딪힌다.
- 인덱스: `(status, created_at DESC)` — 어드민 받은편지함용. `(user_id)`.
- 같은 결제 건에 열린 환불 요청은 하나뿐이다 — 부분 유니크 인덱스 `(purchase_id) WHERE kind='refund' AND status='open'`. 동시 요청 두 개가 앱 검사를 함께 통과해도 DB 가 하나를 막는다.
- 한 파일 한 문장 규칙에 따라 테이블·인덱스·role 을 별개 마이그레이션 파일로 나눈다.

### 5. API

**`GET /api/support/options?kind=`** → `{ items: SupportOption[], balance?: number }`. 401 비로그인.

**`POST /api/support`** body (zod discriminated union on `kind`):

- `{ kind:'error', target: { kind, ref }, body }` — `body` 1~4000자
- `{ kind:'feedback', body }`
- `{ kind:'refund', purchaseId, reason, body? }` — `reason` 은 4개 리터럴 enum

처리 순서:

1. 401 / 400 검증.
2. 레이트리밋 — `src/lib/reports/rate-limit.ts` 의 incr 방식으로 사용자당 10분 5건. 넘으면 429 "잠시 후 다시 시도해 주세요".
3. **소유 재확인** — error 의 target 은 options 와 같은 쿼리로 다시 찾아 `target_label` 을 서버가 만든다(클라이언트가 보낸 문구는 믿지 않는다). refund 의 `purchaseId` 는 이 사용자의 paid 건이어야 하고, 같은 건에 open 요청이 있으면 409.
4. INSERT.
5. 메일 발송 — 실패는 `console.error` 만. 응답은 201 그대로.

route.ts 는 얇게, 로직은 `_lib/handler.ts` 의 `handleCreateSupportTicket(raw, userId, deps)` — 기존 컨벤션.

### 6. 메일 — `src/lib/support/mailer.ts`

- `resend` 패키지. `Mailer` 인터페이스(`send({ subject, text, replyTo })`)를 handler 에 주입해 테스트에선 가짜로 바꾼다.
- 받는 곳 `SUPPORT_MAIL_TO`, 보내는 곳 `SUPPORT_MAIL_FROM`, `reply_to` 는 사용자 이메일(없으면 생략).
- 제목: `[오류 문의] 궁합 · 동진 × 민수 — 동진` / `[환불 요청] 이용권 5장 · 5,000원 — 동진` / `[피드백] — 동진`.
- 본문(텍스트): 문의 번호, 사용자 id·이름·이메일·provider, 대상/결제 건(payment_id 포함), 사유, 본문, 접수 시각(KST).
- `RESEND_API_KEY` 가 비면 발송을 건너뛰고 경고 로그 한 줄. 결제의 "준비 중" 잠금처럼 기능을 막지는 않는다 — 문의는 DB 에 남는다.

`.env.example` 에 항목 추가:

```
# --- 고객 문의 메일 (Resend) ---
# 키가 비면 문의는 DB 에만 쌓이고 메일은 건너뛴다.
# FROM 은 Resend 에서 인증한 도메인의 주소여야 한다.
RESEND_API_KEY=
SUPPORT_MAIL_FROM=
SUPPORT_MAIL_TO=projectn.contact@gmail.com
```

### 7. 어드민 토대

- 마이그레이션 `users.role text NOT NULL DEFAULT 'user' CHECK IN ('user','admin')`. 본인 계정은 운영 DB 에서 SQL 로 올린다.
- `src/lib/auth/admin.ts` — `requireAdmin()`: 세션 → users.role 조회 → 아니면 null. **provider='admin'(심사용 로그인)과 무관하다**는 주석을 단다.
- 이번 범위 밖(다음 작업): `/admin` 화면(문의 목록·상세·`status`/`admin_note` 변경), 포트원 결제 취소 API 연동. `support_tickets` 의 `status`·`admin_note`·`resolved_at` 과 `(status, created_at)` 인덱스는 그때를 위해 미리 둔다.
- 환불 요청은 이번엔 "접수" 까지다. 실제 돈 환불과 이용권 회수는 어드민에서 처리한다.

## 테스트

- `options.test.ts`: 가짜 SqlClient 로 행 → 표시 문구 매핑(날짜 메타, 삭제된 항목, 보너스 표기, "기타" 꼬리, 요청됨 표시).
- `handler.test.ts`: 401 / kind 별 400 / 남의 target·purchase 404 / 중복 환불 409 / 429 / 정상 201 + INSERT 인자 + 메일 호출 / 메일 실패해도 201 / 키 없을 때 메일 건너뜀.
- 보내기 활성 조건은 순수 함수 `canSubmit` 로 떼어 단위 테스트한다(이 저장소의 컴포넌트 테스트는 node 환경 `renderToStaticMarkup` 뿐이라 상호작용을 못 돌린다).
- `AppMenu`·`SupportDialog` 의 열고 닫기·전송은 브라우저에서 확인한다.

## 범위 밖

- `/admin` 화면, 포트원 취소, 이용권 회수
- 사용자가 자기 문의 내역을 보는 화면
- 첨부파일(스크린샷)
