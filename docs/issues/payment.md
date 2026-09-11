# Phase 4 - 결제

> 상태: ✅ 완료 / 🚧 진행 중 / ⬜ 대기

## ✅ ISSUE-014. 결제 연동 (단건 구매)

포트원 v2 + **NHN KCP 채널 하나**(카드·네이버페이·카카오페이·토스페이). 설계: `docs/superpowers/specs/2026-09-06-portone-kcp-design.md`.

이력: 2026-08-11 포트원 최초 연동 → 08-12 KG이니시스 단일 채널 → 08-20 이니시스가 구매자 휴대폰을 요구해 토스페이먼츠 직결로 교체 → **2026-09-06 토스 심사 지연으로 포트원 + KCP 로 복귀.** 토스 코드는 커밋 `11483ff`~`0386ba1` 사이에 있다.

- 주문 생성 → 결제창(포트원이 승인까지) → 완료 API(PC) / 착지 라우트(모바일) / 웹훅 삼중 확정. 판단은 언제나 포트원 조회 API 결과다. 금액은 `purchases.amount` 로만 대조한다.
- 노출 수단은 `PORTONE_METHODS` env 가 정한다. 간편결제는 포트원 콘솔의 KCP 채널에 제휴가 켜진 뒤에만 켠다 — 계약 없이 켜면 화면에는 뜨고 결제창에서 실패한다.
- 배포 전 체크: `.env.production.local`·호스팅 env 의 옛 `PORTONE_CHANNEL_KEY_INICIS` 를 `PORTONE_CHANNEL_KEY_KCP` 로 바꿔 채우고, `PORTONE_WEBHOOK_SECRET` 을 콘솔 값과 맞춘다(없으면 결제 화면이 잠긴다). 간편결제는 KCP 채널에 제휴가 켜진 뒤에만 `PORTONE_METHODS` 에 넣는다.
- 주문 ID 는 `saju` + 32자(하이픈 없는 uuid). KCP 가 영숫자 40자만 받는다. 옛 `saju-…` 행은 그대로다.
- 구매자 정보는 이름·이메일만 보낸다. 휴대폰은 없다 — KCP 가 실제로 요구하면 입력 UI 는 별건.
- 환불·취소 API 는 범위 밖. 당분간 포트원 콘솔에서 수동으로 한다(아래).
- **채널은 반드시 KCP V2 모듈이어야 한다.** 콘솔 채널 추가에서 결제 모듈을 `일반/정기결제 · V2`(PG Provider `kcp_v2`)로 고른다. V1 모듈(`kcp`) 채널키를 넣으면 V2 SDK 가 어떤 파라미터를 보내도 "요청을 파싱하는 과정에서 에러 — KCP 에 대해 지원하지 않는 기능" 으로 거절한다(2026-09-11 확인).
- 2026-09-11 테스트 채널(`nhn 사주 v2`, 공용 MID T0000)로 확인: 카드 결제창이 구매자 이름·이메일만으로 열린다 — 이니시스와 달리 휴대폰을 요구하지 않는다. 카드사 인증 팝업 이후(승인·완료 화면)는 팝업 차단 때문에 확인하지 못했다. 카카오페이 창은 아직 안 띄워 봤다.

### 환불 처리 (수동)

`isPaid` 는 `purchases.status = 'paid'` 로만 판정한다(`src/lib/profiles/store.ts`). 포트원
콘솔에서 환불만 누르면 이 컬럼이 바뀌지 않아 고객은 리포트를 계속 볼 수 있다.
`Transaction.Cancelled` 웹훅은 현재 `Transaction.Paid` 가 아닌 이벤트로 분류돼 200 으로
그냥 흘려보낸다(`src/app/api/payments/webhook/_lib/handler.ts`) — 자동으로 반영되지 않는다.

콘솔에서 환불한 뒤, 반드시 아래를 수동으로 실행해 행을 내린다:

```sql
UPDATE purchases
   SET status = 'refunded'
 WHERE payment_id = '<포트원 paymentId>'
   AND status = 'paid';
```

### 정산 안 된 결제 찾기 (리컨실리에이션)

`getPayment` 지속 실패, 포트원 웹훅 재시도 만료, `markPaid` 도중 DB 장애 등으로
포트원은 `PAID`인데 우리 DB 는 `pending`에 갇힌 행이 생길 수 있다. 아래로 후보를 찾는다:

```sql
SELECT payment_id, created_at
  FROM purchases
 WHERE status = 'pending'
   AND created_at < now() - interval '1 hour';
```

걸린 각 건은 포트원 콘솔(또는 API)에서 실제 상태를 다시 확인한 뒤에만 "포기된 주문"으로
단정한다 — 위 조건만으로는 진행 중인 가상계좌 입금 대기와 구분되지 않는다.

## ⬜ ISSUE-015. 유료 리포트 콘텐츠 (F006)

- 성격 / 직업 / 재물 / 연애 / 결혼 / 인간관계 / 용신 분석 / 대운 분석
- 룰 기반 콘텐츠(ISSUE-010) 확장
