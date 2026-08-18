# Neon 드라이버와 트랜잭션

> 왜 돈이 움직이는 경로가 CTE 한 문장인가. 2026-08-18 이용권 전환 이후 정리.

## 한 줄

**포스트그레스에 트랜잭션은 있다.** 없는 건 우리가 쓰는 HTTP 드라이버의 *대화형* 트랜잭션이고,
그래서 정확성의 근거를 앱 코드가 아니라 스키마 제약에 두었다.

---

## 1. 흔한 오해

"Neon HTTP 드라이버에 트랜잭션이 없다"는 말은 줄여 쓰면 오해를 만든다. 정확히는 세 층을 갈라야 한다.

| 층 | 있나 | 설명 |
| --- | --- | --- |
| 포스트그레스의 트랜잭션 | **있다** | 당연히 있다. ACID 그대로다. |
| 문장 하나의 원자성 | **있다** | 모든 단일 문장은 이미 자기 자신의 트랜잭션이다 (autocommit) |
| 여러 왕복에 걸친 대화형 트랜잭션 | **없다** | `BEGIN` → JS 에서 판단 → `COMMIT`. 이게 안 된다 |

세 번째만 없다. 그리고 우리 설계는 두 번째를 쓴다.

## 2. HTTP 드라이버가 못 하는 것

`src/lib/db.ts` 는 `neon(url)` 을 쓴다. 쿼리 하나가 HTTP 요청 하나로 나가고 끝난다.
세션이 유지되지 않으므로 다음 쿼리는 아예 다른 커넥션에 떨어질 수 있다.

드라이버 자신의 타입 선언이 이렇게 적어 두었다
(`node_modules/@neondatabase/serverless/index.d.mts`):

```
Returns an async tagged-template function that runs a single SQL query
(no session or transactions) with low latency over https.
...
The returned function has a `transaction()` function property, which
supports multiple queries run in a non-interactive transaction.
```

그래서 이런 코드는 성립하지 않는다:

```
BEGIN                          ← 요청 1
SELECT balance ...             ← 요청 2 (다른 커넥션일 수 있다)
   ...JS 에서 충분한지 판단...
UPDATE ... SET balance = ...   ← 요청 3
COMMIT                         ← 요청 4
```

`BEGIN` 을 건 커넥션과 `COMMIT` 을 거는 커넥션이 같다는 보장이 없다.

### 왜 이게 돈 계산에서 치명적인가

"읽고 → 판단하고 → 쓴다" 를 세 왕복으로 하면 **동시 요청 두 개가 같은 잔액을 읽는다.**
잔액 1장인 사용자가 두 서비스를 동시에 열면 둘 다 "1 >= 1, 충분하다" 로 통과하고
둘 다 차감해 잔액이 −1 이 된다. 없는 돈을 쓴 것이다.

## 3. 그래서 어떻게 했나 — 문장 하나가 곧 트랜잭션

포스트그레스는 **단일 문장이 실패하면 그 문장이 한 일 전부를 되돌린다.**
차감을 CTE 한 문장에 몰아넣으면 트랜잭션 없이도 원자성이 생긴다.

`src/lib/tickets/spend.ts` 의 실제 구조(요약):

```sql
WITH claim AS (            -- ① 열람 권한을 만든다
  INSERT INTO entitlements (user_id, feature, subject_key, cost)
  SELECT $u, $f, $s, $c
   WHERE (SELECT balance FROM ticket_wallets WHERE user_id = $u) >= $c
  ON CONFLICT (user_id, feature, subject_key) DO NOTHING
  RETURNING id
), pay AS (                -- ② 권한이 생겼을 때만 차감한다
  UPDATE ticket_wallets SET balance = balance - $c
   WHERE user_id = $u AND EXISTS (SELECT 1 FROM claim)
  RETURNING balance
), ledger AS (             -- ③ 원장에 기록한다
  INSERT INTO ticket_entries (user_id, delta, reason, entitlement_id)
  SELECT $u, -$c, 'spend', id FROM claim
)
SELECT (SELECT id FROM claim), (SELECT balance FROM pay)
```

적립 쪽(`src/lib/tickets/wallet.ts`)도 같은 모양이다 — 결제 확정 UPDATE 와 지갑 적립과
원장 기록이 한 문장이라, **"돈은 받았는데 이용권이 없다" 가 구조적으로 불가능하다.**
세 문장으로 쪼갰다면 그 사이에 프로세스가 죽었을 때 반쪽 상태가 남는다.

## 4. 네 갈래를 코드가 아니라 제약이 판정한다

이게 이 설계의 요점이다. 앱 코드에는 "잔액이 충분한가" 를 판단하는 `if` 가 없다.

| 상황 | 무슨 일이 일어나나 | 판정 주체 |
| --- | --- | --- |
| 정상 | 권한이 생기고 잔액이 준다 | — |
| 중복 요청 (더블클릭·재시도) | `ON CONFLICT DO NOTHING` 으로 `claim` 이 비고 → `EXISTS` 가 거짓 → **차감이 아예 안 일어난다** | `entitlements_unique` (0014) |
| 잔액 부족 | 게이트 `>= $c` 가 거짓 → `claim` 자체가 안 생김. 지갑 행이 없으면 `NULL >= 1` 이 거짓이라 같은 갈래 | `WHERE` 게이트 |
| 서로 다른 서비스 동시 사용 | 두 UPDATE 가 행 잠금으로 직렬화 → 두 번째가 음수 → **문장 전체 롤백** (권한 INSERT 까지) | `CHECK (balance >= 0)` (0012) |

마지막 줄이 대화형 트랜잭션의 빈자리를 메우는 부분이다. 앱이 개입할 여지 자체가 없다.

### 공부할 포인트 — CTE 는 서로의 쓰기를 못 본다

`pay` 가 `EXISTS (SELECT 1 FROM claim)` 이라고 **CTE 의 출력을 참조**하는 게 중요하다.
만약 `EXISTS (SELECT 1 FROM entitlements WHERE ...)` 라고 테이블을 직접 조회했다면
**방금 `claim` 이 넣은 행이 보이지 않는다** — 한 문장 안의 모든 하위 문장은 같은 스냅샷을 본다.
`RETURNING` 으로 흘려보낸 값만 다음 CTE 가 볼 수 있다.

### 순서가 load-bearing 이다

권한 INSERT 가 먼저, 차감 UPDATE 가 나중이다. 뒤집으면 차감은 됐는데 권한이 UNIQUE 에
걸려 사라지는 경우가 생긴다 — 사용자는 이용권만 잃는다.

## 5. 선택지는 세 갈래였다

| 방식 | 중간 결과로 분기 | 정확성의 근거 | 채택 |
| --- | --- | --- | --- |
| HTTP + 단일 문장 (CTE) | 불가 — SQL 안에서 해결 | **스키마 제약** | **○** |
| HTTP + `sql.transaction([q1,q2,q3])` | 불가 — 문장 목록을 미리 확정 | 스키마 제약 | × |
| WebSocket `Pool` / `Client` | 가능 — 진짜 `BEGIN`/`COMMIT` | 앱 코드 | × |

같은 패키지가 `Pool` 과 `Client` 도 내보낸다(확인함). WebSocket 으로 가면 코드는 평범한
`BEGIN…COMMIT` 이 되고 읽기 쉬워진다. 대신 두 가지를 잃는다:

1. 서버리스에서 커넥션 수명·풀 관리가 새로 붙는다.
2. **정확성의 근거가 앱 코드로 옮겨간다.** 지금은 앱에 버그가 있어도 `CHECK` 가 막지만,
   `BEGIN…COMMIT` 은 코드가 옳게 짜였을 때만 옳다.

바꿀 이유가 생긴다면 1번(운영 편의)이 아니라 "SQL 안에서 표현할 수 없는 분기가 필요해졌을 때"
여야 한다. 지금까지는 그런 분기가 없었다.

## 6. 직접 확인해 보는 법

**문장이 파싱·타입추론되는지** (실행 안 함, 안전):

```
EXPLAIN <문장>
```

계획만 세우고 실행하지 않는다. 컬럼 오타, 파라미터 타입추론 실패,
그리고 `ON CONFLICT` 의 인덱스 추론 실패(SQLSTATE 42P10)까지 여기서 걸린다.
2026-08-18 에 적립·차감·재조회 세 문장 모두 통과 확인.

**네 갈래가 실제로 그렇게 도는지** (임시 유저 필요, 아직 안 함):

```sql
INSERT INTO ticket_wallets (user_id, balance) VALUES (<u>, 1);
-- 1회: 차감 CTE, subject '1'  → entitlement_id 가 NOT NULL, 잔액 0
-- 2회: 똑같이 한 번 더        → entitlement_id 가 NULL (중복)
-- 3회: 같은 CTE, subject '2'  → entitlement_id 가 NULL (잔액 부족)
SELECT (SELECT balance FROM ticket_wallets WHERE user_id=<u>) AS bal,
       (SELECT count(*) FROM entitlements  WHERE user_id=<u>) AS ents,
       (SELECT count(*) FROM ticket_entries WHERE user_id=<u>) AS entries;
-- 반드시: bal=0, ents=1, entries=1
```

마지막 줄이 검증의 전부다. 2회 실행 뒤에도 `entries=1` 인 것이 곧
**"중복 요청이 이중 차감하지 않는다"** 의 증명이다.

> ⚠️ 단위 테스트는 이걸 못 잡는다. `spend.test.ts` 는 SQL 을 실행하지 않는 가짜 클라이언트를
> 쓰기 때문에 **문장의 텍스트**만 검사한다. 그래서 `EXISTS (SELECT 1 FROM claim)` 절이
> 테스트에 텍스트로 고정돼 있다 — 그 절을 지워도 테스트가 통과하던 시절이 있었고,
> 그 상태로 나갔다면 중복 요청마다 조용히 이중 차감이 났을 것이다.

## 7. 더 읽을거리

찾아볼 포스트그레스 개념들:

- **autocommit / 단일 문장의 원자성** — 왜 문장 하나가 트랜잭션인가
- **data-modifying CTE (`WITH ... INSERT/UPDATE`)** — 참조되지 않아도 정확히 한 번 끝까지 실행된다.
  `ledger` CTE 를 바깥 `SELECT` 가 읽지 않는데도 도는 이유다
- **CTE 의 스냅샷 격리** — 같은 문장 안의 하위 문장들이 서로의 쓰기를 못 보는 이유
- **READ COMMITTED 의 재평가 (EvalPlanQual)** — 행 잠금이 풀린 뒤 `WHERE` 를 다시 보고
  갱신된 값으로 계산한다. 동시 차감이 −1 을 만들어 `CHECK` 에 걸리는 경로
- **`ON CONFLICT` 의 arbiter index 추론** — 어떤 유니크 인덱스가 선택되는가
- **SQLSTATE 23514 (check_violation)** — 제약 이름까지 봐야 하는 이유는
  `src/lib/tickets/spend.ts` 의 `isBalanceCheckViolation` 주석에 있다

## 관련 파일

- `src/lib/db.ts` — 드라이버를 만드는 유일한 곳
- `src/lib/tickets/wallet.ts` — 적립 (결제 확정 + 지급)
- `src/lib/tickets/spend.ts` — 차감 (권한 부여 + 차감 + 원장)
- `migrations/0012_ticket_wallets.sql` — `CHECK (balance >= 0)`
- `migrations/0014_entitlements_unique.sql` — 중복 차감을 막는 UNIQUE
- `docs/superpowers/specs/2026-08-17-ticket-points-design.md` — §2 가 이 판단의 원문
