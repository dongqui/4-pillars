# Phase 4 - 결제

> 상태: ✅ 완료 / 🚧 진행 중 / ⬜ 대기

## ✅ ISSUE-014. 결제 연동 (단건 구매)

포트원 v2. 설계: `docs/superpowers/specs/2026-08-11-portone-payment-design.md`.
2026-08-12 수단 구성이 KG이니시스 채널 하나(카드·네이버페이·카카오페이·토스페이)로 바뀌었다. 노출 수단은 `PORTONE_METHODS` env 가 정한다: `docs/superpowers/specs/2026-08-12-inicis-easypay-design.md`.

- 주문 생성 → 결제창 → 완료 API·웹훅 이중 확정. 금액은 `purchases.amount` 로만 대조한다.
- `purchases.payment_id` (마이그레이션 0010) 로 웹훅이 행을 찾는다.
- 환불·취소 API 는 범위 밖. 당분간 포트원 콘솔에서 수동으로 한다.
- **키를 채운 뒤 첫 실결제에서 확인할 것**은 설계 문서 §11 에 있다.

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
