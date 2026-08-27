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

/**
 * 이 사용자가 이 기능에 대해 가진 권한의 subject_key 전부.
 *
 * hasEntitlement 는 한 건을 묻는다. 선택 화면은 연도 11칸의 소유 여부를 한 번에
 * 물어야 해서 배치가 필요하다 — 칸마다 hasEntitlement 를 부르면 왕복이 11번이다.
 */
export async function listEntitledSubjects(
  userId: string,
  feature: Feature,
  client: SqlClient = sql,
): Promise<string[]> {
  const rows = await client`
    SELECT subject_key FROM entitlements
     WHERE user_id = ${userId}::bigint AND feature = ${feature}
  `;
  return rows.map((r) => String(r.subject_key));
}
