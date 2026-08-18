import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

export type RefundResult =
  | { ok: true; kind: "refunded"; balance: number }
  | { ok: true; kind: "nothing_to_refund"; balance: number };

interface RefundInput {
  userId: string;
  feature: Feature;
  subjectKey: string;
}

/**
 * 차감을 되돌린다. spendTicket 의 정확한 역이다.
 *
 * ⚠️ CTE 한 문장인 이유는 차감과 같다 — Neon HTTP 드라이버에 대화형 트랜잭션이 없어,
 * 권한 삭제와 잔액 복구를 두 문장으로 나누면 그 사이에 프로세스가 죽었을 때
 * "권한은 사라졌는데 돈은 안 돌아온" 상태가 남는다.
 *
 * 멱등성은 DELETE ... RETURNING 이 준다. 두 번 불러도 두 번째는 지울 행이 없어
 * revoked 가 비고, EXISTS 가 거짓이라 잔액이 오르지 않는다 —
 * 차감의 ON CONFLICT DO NOTHING 과 정확히 대칭이다.
 *
 * 되돌리는 장수를 FEATURE_COST 가 아니라 지워진 행의 cost 에서 읽는 이유:
 * 가격표는 바뀌지만 "이때 몇 장을 냈는가"는 사실이다. 단가가 오른 뒤 옛 건을
 * 되돌리면서 현재 가격표를 쓰면 더 많이 돌려주게 된다.
 *
 * 원장의 entitlement_id 는 NULL 이다 — 참조하려던 행을 방금 지웠다.
 * reason='refund' 와 양수 delta 가 그 자체로 식별자다.
 *
 * ledger 의 user_id 는 ${a.userId} 를 다시 바인딩하지 않고 revoked 의
 * RETURNING user_id 를 그대로 쓴다. 계획 문서의 참고 SQL은 여기서 파라미터를
 * 다시 바인딩했는데, 그러면 테스트가 기대하는 바인딩 개수와 어긋난다(자세한 경위는
 * docs/superpowers/plans/2026-08-18-ticket-integration.md 의 해당 자리 메모 참고).
 * WHERE 절이 이미 user_id 로 걸렀으니 두 값은 항상 같지만, 지워진 행에서 그대로
 * 물려받는 쪽이 더 팽팽하다 — 원장 행이 "방금 삭제된 그 권한 행"에 증명 가능하게
 * 묶이고, 우연히 같은 값을 두 번 바인딩한 것이 아니게 된다.
 *
 * ok: false 갈래가 없다. 없는 권한을 되돌리는 것은 실패가 아니라 이미 되돌아간
 * 상태이고, 호출자가 원하던 결과다. 실제 장애는 예외로 나간다.
 */
export async function refundTicket(
  a: RefundInput,
  client: SqlClient = sql,
): Promise<RefundResult> {
  // back 이 아무 것도 못 찾으면(ticket_wallets 에 그 user_id 행이 없으면) 권한은
  // 지워지고 +cost 원장 행도 남지만 잔액은 복구되지 않는다 — 오늘은 닿지 않는다.
  // entitlements 행이 존재하려면 spendTicket 이 성공했어야 하고, 그건 그때 wallet
  // 행이 있었다는 뜻이며 wallet 행을 지우는 경로가 없다.
  const rows = await client`
    WITH revoked AS (
      DELETE FROM entitlements
       WHERE user_id = ${a.userId}::bigint
         AND feature = ${a.feature}
         AND subject_key = ${a.subjectKey}
      RETURNING id, cost, user_id
    ), back AS (
      UPDATE ticket_wallets
         SET balance = balance + (SELECT cost FROM revoked), updated_at = now()
       WHERE user_id = ${a.userId}::bigint AND EXISTS (SELECT 1 FROM revoked)
      RETURNING balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason)
      SELECT user_id, cost, 'refund' FROM revoked
      RETURNING id
    )
    SELECT (SELECT id FROM revoked) AS revoked_id,
           COALESCE(
             (SELECT balance FROM back),
             (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint)
           ) AS balance
  `;
  const row = rows[0];
  // COALESCE 가 필요한 이유: 되돌릴 것이 없으면 back 이 비어 잔액이 NULL 이다.
  // 그때는 아무것도 바뀌지 않았으므로 지갑을 그대로 읽어도 옳은 값이라,
  // 차감 쪽처럼 두 번째 쿼리를 보낼 이유가 없다.
  const balance = Number(row?.balance ?? 0);
  return row?.revoked_id != null
    ? { ok: true, kind: "refunded", balance }
    : { ok: true, kind: "nothing_to_refund", balance };
}
