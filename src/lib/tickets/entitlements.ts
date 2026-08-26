import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

/**
 * 이 사용자가 이 대상에 대한 열람 권한을 이미 갖고 있는가.
 *
 * spendTicket 이 권한 행을 넣는 자리라면 여기는 읽기만 하는 자리다. 확인 화면이
 * "이용권을 또 쓰나요" 에 답하려면 **행이 아니라 권한**을 봐야 한다 — 흐름 행은
 * 공짜로 만들어지고 차감은 생성 자리에서 일어나므로, 생성이 한도나 잔액에서
 * 막히면 행만 남고 권한은 없는 상태가 된다.
 */
export async function hasEntitlement(
  userId: string,
  feature: Feature,
  subjectKey: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    SELECT 1 AS id FROM entitlements
     WHERE user_id = ${userId}::bigint
       AND feature = ${feature}
       AND subject_key = ${subjectKey}
     LIMIT 1
  `;
  return rows.length > 0;
}
