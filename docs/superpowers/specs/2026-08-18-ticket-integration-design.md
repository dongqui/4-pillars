# 이용권 게이트 통합 — 병합·궁합·상담

> 2026-08-18 · `claude/payment-points-system-ebf8da` 를 main 과 합치고 세 기능에 게이트를 연다

## 0. 한 줄

**main 이 비워 둔 자리에 이용권을 끼운다.** 리포트는 이미 됐고, 궁합과 상담이 남았다.

## 1. 배경

이용권 시스템(구매·잔액·차감·원장)은 별도 브랜치에서 끝났다. 그 사이 main 에는 궁합과
AI 상담이 들어갔고, 두 기능 모두 **이용권이 있다는 전제로 쓰였지만 이용권 자체는 없다.**

main 이 남긴 접점은 세 곳이다. 전부 "여기가 그 자리다"라고 주석에 적혀 있다.

| 파일 | 상태 |
|---|---|
| `src/lib/consultations/ticket-port.ts` | `TicketPort` 인터페이스 선언 + 던지는 스텁. "이 파일 하나가 다른 세션과의 유일한 접점이다" |
| `src/lib/matches/access.ts` | `canCreateMatch` 에 "⚠️ 이용권 게이트가 들어올 자리다" |
| `src/app/consult/page.tsx` | 잔액 칩이 꺼져 있다. "getBalance 가 실제로 배선된 뒤에 켠다" |

**지금 main 에서 상담은 아예 열리지 않는다.** `stubTicketPort.spend` 가 던지도록 일부러
만들어 두었기 때문이다 — 배선 전에 상담이 공짜로 열리는 것보다 낫다는 판단이었다.

### 확정된 결정

| 항목 | 결정 |
|---|---|
| 단가 | 리포트·궁합·상담 모두 1장 |
| 궁합 차감 단위 | `matches` 행 하나. 같은 쌍이라도 **관계 유형이 다르면 별도 1장** |
| 궁합 생성 실패 | 되돌리지 않는다. 권한이 남아 재시도가 공짜다 (리포트와 같은 모양) |
| 상담 생성 실패 | 되돌린다. main 의 `openConsultation` 이 이미 그렇게 쓰여 있다 |
| refund 동작 | 권한 행을 지우고 그 행의 `cost` 만큼 잔액 복구 |
| 생성 한도 | 없애지 않는다. 정상 사용자가 안 닿는 숫자로 올려 사고용 미달림으로 남긴다 |
| 호출 구조 | 각 기능이 `spendTicket` 을 직접 부른다. `tickets` 는 어떤 기능도 모른다 |

### 왜 한도를 남기는가

돈을 내고 쓰는 사용자를 막을 이유는 없다 — 한도는 이용권이 없던 시절 "누가 공짜로 LLM
예산을 태운다"의 대용품이었고, 그 역할은 이제 돈이 한다.

남은 쓸모는 **돈이 걸리지 않은 경로**다. `ticket_entries.reason` 의 `grant`(수기·프로모션
지급)로 이용권이 잘못 풀리거나, 차감 게이트 자체에 버그가 생기면 막을 것이 없다. 그래서
숫자는 "정상 사용자를 세는" 값이 아니라 "사고만 걸리는" 값이어야 한다.

> ⚠️ 미해결: **궁합 1건의 LLM 원가가 1,000원보다 작은지 아무도 재보지 않았다.** 크다면
> 많이 쓸수록 손해다. 궁합은 리포트와 달리 원국 단위 공유 캐시가 없어 항상 LLM 을
> 부르므로(`rate-limit.ts` 주석) 리포트보다 더 걸린다. 이 작업의 범위 밖이지만 배포 전에
> 재야 한다.

---

## 2. 병합 (1단계)

main 을 이 브랜치로 병합한다. 충돌 6개는 전부 기계적이다.

| 파일 | 무엇이 부딪히나 | 해결 |
|---|---|---|
| `src/lib/profiles/store.ts` | main 은 `kind` 추가, 우리는 `isPaid`→`isUnlocked` + 조인 교체 | 둘 다 살린다 |
| `src/app/home/page.tsx` | main 은 `kind='self'` 필터, 우리는 잔액 칩 | 둘 다 살린다 |
| `src/lib/profiles/store.test.ts` | 양쪽 단언 | 둘 다 살린다 |
| `to-home-entry.test.ts`, `to-meta.test.ts`, `to-birth-input.test.ts` | 픽스처에 `kind` 추가 vs `isUnlocked` 개명 | 둘 다 반영 |
| `src/app/checkout/_lib/to-order.test.ts` | main 이 수정, 우리가 삭제 | **삭제가 이긴다** — 그 소스 파일은 이미 없다 |

### 마이그레이션 번호 중복은 그대로 둔다

두 브랜치가 병렬로 0012–0015 를 썼다.

| 번호 | main | 이 브랜치 |
|---|---|---|
| 0012 | `profiles_kind` | `ticket_wallets` |
| 0013 | `matches` | `entitlements` |
| 0014 | `matches_unique` | `entitlements_unique` |
| 0015 | `match_sections` | `ticket_entries` |

**이름을 바꾸지 않는다.** `schema_migrations` 는 파일명으로 추적하고 개발 DB 에는 양쪽이
모두 적용돼 있다 — 개명하면 이미 적용된 것이 미적용으로 보여 재실행되거나 추적이 깨진다.
서로 다른 테이블을 건드리므로 실행 순서도 문제가 없다.

대신 `migrations/README.md` 를 새로 만들어 이 구간이 두 브랜치의 병렬 산물임을 남긴다.
다음 번호는 0020 부터다.

### 삭제

`pairKey` 와 그 테스트(`src/lib/tickets/features.ts`)를 지운다. 궁합 권한을 정렬된 두
프로필 id 로 잡으려고 만들었으나, `matches` 행이 단위가 되면서 쓸 자리가 사라졌다.
`pairKey` 는 관계 유형을 무시해 단위가 더 굵다 — 남겨 두면 두 벌의 규칙이 된다.

---

## 3. refund — 새로 만드는 것

`src/lib/tickets/refund.ts`. 차감의 정확한 역이고, 같은 이유로 CTE 한 문장이다
(Neon HTTP 드라이버에 대화형 트랜잭션이 없다 — `docs/issues/db-transactions.md`).

```sql
WITH revoked AS (
  DELETE FROM entitlements
   WHERE user_id = $u AND feature = $f AND subject_key = $s
  RETURNING id, cost
), back AS (
  UPDATE ticket_wallets
     SET balance = balance + (SELECT cost FROM revoked), updated_at = now()
   WHERE user_id = $u AND EXISTS (SELECT 1 FROM revoked)
  RETURNING balance
), ledger AS (
  INSERT INTO ticket_entries (user_id, delta, reason)
  SELECT $u, cost, 'refund' FROM revoked
)
SELECT (SELECT id FROM revoked) AS revoked_id,
       COALESCE(
         (SELECT balance FROM back),
         (SELECT balance FROM ticket_wallets WHERE user_id = $u)
       ) AS balance
```

`COALESCE` 가 필요한 이유: 되돌릴 것이 없으면 `back` 이 비어 잔액이 NULL 로 나온다.
그때는 아무것도 바뀌지 않았으므로 지갑을 그대로 읽어도 옳은 값이다 — 차감 쪽처럼
두 번째 쿼리(`settle`)를 보낼 이유가 없다. 지갑 행 자체가 없으면 여전히 NULL 이고,
호출자가 0 으로 접는다.

세 가지가 이 문장의 요점이다.

**멱등성은 `DELETE ... RETURNING` 이 준다.** 두 번 불러도 두 번째는 지울 행이 없어
`revoked` 가 비고, `EXISTS` 가 거짓이라 잔액이 오르지 않는다. 차감의
`ON CONFLICT DO NOTHING` 과 정확히 대칭이다.

**되돌리는 장수는 `FEATURE_COST` 가 아니라 지워진 행의 `cost` 에서 온다.** 스키마 설계의
이유 그대로다 — 가격표는 바뀌지만 "이때 몇 장을 냈는가"는 사실이다. 단가가 오른 뒤 옛
건을 환불하면서 현재 가격표를 쓰면 틀린 값이 나온다.

**원장의 `entitlement_id` 는 NULL 이다.** 참조하려던 행을 방금 지웠기 때문이다.
`reason='refund'` 와 양수 `delta` 가 그 자체로 식별자다.

### 반환 타입

```ts
export type RefundResult =
  | { ok: true; kind: "refunded"; balance: number }
  | { ok: true; kind: "nothing_to_refund"; balance: number };
```

없는 권한을 되돌리는 것은 실패가 아니다 — 이미 되돌아간 상태이고, 호출자가 원하던
결과다. `ok: false` 갈래가 없다. 실제 장애는 예외로 던진다.

---

## 4. 세 기능 배선

### 4.1 feature 목록

`FEATURE_IDS` 에 `consultation` 을 더한다. `FEATURE_COST` 는 셋 다 1.

```
리포트   ('full_report',   profileId)         HTTP  POST /api/tickets/spend
궁합     ('compatibility', match.id)          서버  gated-generator
상담     ('consultation',  consultation.id)   서버  openConsultation
```

### 4.2 HTTP 차감은 리포트 전용이다

세 기능의 차감 시점이 다르다.

| | 차감 시점 | 경로 |
|---|---|---|
| 리포트 | 사용자가 잠금 CTA 를 누를 때 | HTTP |
| 궁합 | `/match/[id]` 렌더 중 LLM 호출 직전 | 서버 내부 |
| 상담 | `POST /api/consultations` 처리 중 | 서버 내부 |

따라서 `src/app/api/tickets/spend/route.ts` 의 `ownsSubject` 는 `compatibility` 와
`consultation` 모두 `false` 를 돌려준다. `switch` + `never` 가 `consultation` 추가 시
컴파일을 깨뜨릴 것이므로, 그 자리에 **"HTTP 로는 차감되지 않는다"** 를 주석으로 남긴다.

소유 확인이 없는 것이 아니라 다른 곳에서 이미 한다. `findOrCreateMatch(userId, ...)` 와
`createConsultation({userId, ...})` 가 `user_id` 로 행을 만들고 조회한다.

### 4.3 궁합

`canCreateMatch`(`src/lib/matches/access.ts`)에 잔액 확인을 더한다. `MatchAccess` 의
`reason` 에 `"insufficient_tickets"` 한 갈래가 는다.

**여기서는 차감하지 않는다.** 그 파일의 기존 주석이 이유를 이미 적어 두었다 — 같은 쌍·같은
관계를 다시 제출하면 `matches_unique` 로 기존 행에 수렴해 LLM 을 한 번도 부르지 않는데,
만들기에서 차감하면 그 요청이 이용권을 먹는다. 잔액 확인은 여기서, 차감은 생성하는
자리에서다. 한도(`peekMatchLimit`/`checkMatchLimit`)가 이미 같은 모양으로 갈라져 있다.

차감은 `src/app/api/matches/_lib/gated-generator.ts` — 한도를 깎는 바로 그 자리다.
`spendTicket({ feature: "compatibility", subjectKey: match.id, ... })` 를 부르고,
`insufficient` 면 생성하지 않는다. 두 번째 방문은 `already` 로 돌아와 공짜다.

잔액이 부족해 생성하지 못한 경우 `/match/[id]` 는 **충전으로 보내는 화면**을 보여준다.
한도 초과(`MatchRateLimitError`)와 다른 화면이어야 한다 — 한도는 기다리면 풀리지만
잔액 부족은 사용자가 할 일이 있다. 리포트의 402 처리와 같은 모양으로,
`/checkout?next=/match/<id>` 로 보내 충전 후 제자리에 돌아오게 한다.

이 상태는 정상 경로에서 잘 나오지 않는다 — 만들기에서 `canCreateMatch` 가 이미 잔액을
확인하기 때문이다. 그 사이에 다른 탭에서 이용권을 썼거나, 링크를 직접 열었을 때 나온다.

생성이 실패해도 되돌리지 않는다. 권한 행이 남아 재시도가 공짜이므로 되돌릴 이유가 없고,
main 이 이미 만들어 둔 "일부라도 확보했으면 보여준다" 경로와 경계를 다시 그을 필요도 없다.

### 4.4 상담

`src/lib/consultations/deps.ts` 의 `stubTicketPort` 를 실구현으로 교체한다. 어댑터가
하는 일은 셋뿐이다.

```ts
const ticketPort: TicketPort = {
  getBalance: (userId) => getBalance(userId),
  spend: async (userId, consultationId) => {
    const r = await spendTicket({
      userId, feature: "consultation", subjectKey: consultationId,
    });
    if (!r.ok) throw new InsufficientTicketsError();
  },
  refund: async (userId, consultationId) => {
    await refundTicket({
      userId, feature: "consultation", subjectKey: consultationId,
    });
  },
};
```

`InsufficientTicketsError` 로 바꿔 던지는 것이 어댑터의 존재 이유다 — main 의 라우트는
그 에러만 402 로 바꾸고, `service.ts` 는 `spend` 가 던지는 것에 의존해 흐름을 짠다
(던지면 `setTicketSpent(true)` 에 닿지 않아 공짜 상담이 목록에 뜨지 않는다).

`refund` 가 `nothing_to_refund` 를 돌려줘도 어댑터는 삼킨다. main 의 catch 는 되돌리기
실패를 로그만 남기고 넘어가도록 쓰여 있고, "되돌릴 것이 없다"는 실패가 아니다.

**`TicketPort` 인터페이스와 `InsufficientTicketsError` 는 그대로 둔다.** main 의
`service.ts`·`route.ts`·테스트가 전부 그 모양에 의존한다. 구현만 갈아 끼운다.

`src/app/consult/page.tsx` 의 잔액 칩을 켠다.

### 4.5 한도 상향

`MATCH_HOURLY_LIMIT` 을 5 에서 **60** 으로 올린다.

가장 큰 패키지가 13장이므로 한 번 충전한 사용자는 이 숫자에 닿을 수 없다. 60/시간은
`grant` 로 대량 지급됐거나 차감 게이트에 버그가 있을 때만 걸린다. 주석에 그 이유를
남긴다 — 숫자만 바꾸고 "왜 이 숫자인가"를 안 적으면 다음 사람이 다시 5 로 내린다.

---

## 5. 테스트

기존 구조를 그대로 따른다 — 순수 함수 + deps 주입, SQL 은 가짜 태그드 템플릿 클라이언트.

- `refund.test.ts` — 두 갈래(`refunded` / `nothing_to_refund`), `DELETE ... RETURNING`
  이 멱등 키라는 것, 되돌리는 장수가 바인딩 값이 아니라 지워진 행의 `cost` 에서 온다는 것
- `matches/access.test.ts` — `insufficient_tickets` 갈래, **잔액 확인이 차감하지 않는다**는 것
- `consultations` 어댑터 — `insufficient` 가 `InsufficientTicketsError` 로 바뀌는 것,
  `nothing_to_refund` 가 삼켜지는 것
- 병합 후 전체 스위트가 green

**동시성은 단위 테스트로 재현할 수 없다.** refund CTE 의 정확성 근거도 차감과 같이
스키마 제약(`entitlements_unique`, `CHECK (balance >= 0)`)이다.

> ⚠️ 차감 CTE 의 런타임 동작은 아직 한 번도 실행된 적이 없다. `EXPLAIN` 으로 파싱만
> 확인했다. refund 가 붙으면 검증할 것이 하나 더 는다 — 배포 전 확인 절차는
> `docs/issues/db-transactions.md` §6 에 있다.

---

## 6. 하지 않는 것

- **LLM 원가 측정** — §1 의 ⚠️. 별도 작업이지만 배포 전에 해야 한다
- **환불 UI·자동 환불** — 포트원 `Transaction.Cancelled` 웹훅은 여전히 삼켜진다.
  수기 절차는 `docs/issues/backlog.md` 에 있다
- **`grant` 지급 경로** — reason 자리만 있고 쓰는 코드는 여전히 없다
- **이용권 내역 화면** — 원장은 쌓이지만 보여주는 화면은 아직 없다
- **마이그레이션 번호 정리** — §2 참조. 그대로 둔다
