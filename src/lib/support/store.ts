import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  type TicketPackageId,
} from "@/lib/payments/pricing";
import { isRefundable, refundAmount, refundWindowStart } from "@/lib/payments/refund";
import {
  OTHER_OPTION,
  type PurchaseOption,
  type RefundReason,
  type ServiceOption,
  type SupportKind,
  type TargetKind,
} from "./types";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

/**
 * 목록 상한. 이용권 기록은 계정이 계속 쌓는 행이라 언젠가 모달이 무거워진다.
 * 오래된 건은 "기타" 로 문의하면 된다 — 페이지네이션을 둘 만한 목록이 아니다.
 */
export const OPTION_LIMIT = 30;

const DELETED = "삭제된 항목";

/** neon 이 timestamptz 를 문자열로도 Date 로도 줄 수 있어 한 곳에서 ISO 로 접는다. */
function toIso(v: unknown): string {
  return (v instanceof Date ? v : new Date(String(v))).toISOString();
}

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * entitlements 한 행 + 조인된 이름들 → 목록 한 줄. 모르는 feature 는 null —
 * 새 서비스가 생겨도 이 모달이 깨지지 않고, 그 서비스는 "기타" 로 문의된다.
 */
export function toServiceOption(r: Record<string, unknown>): ServiceOption | null {
  const ref = String(r.subject_key);
  const createdAt = toIso(r.created_at);
  switch (r.feature) {
    case "full_report":
      return { target: { kind: "full_report", ref }, title: "리포트", sub: text(r.profile_name) ?? DELETED, createdAt };
    case "compatibility": {
      const a = text(r.subject_name);
      const b = text(r.counterpart_name);
      return { target: { kind: "compatibility", ref }, title: "궁합", sub: a && b ? `${a} × ${b}` : DELETED, createdAt };
    }
    case "consultation":
      return {
        target: { kind: "consultation", ref },
        title: "상담",
        sub: r.consult_id == null ? DELETED : (text(r.consult_title) ?? "제목 없는 상담"),
        createdAt,
      };
    case "yearly_flow":
      return {
        target: { kind: "yearly_flow", ref },
        title: r.flow_year == null ? "한 해의 흐름" : `${Number(r.flow_year)} 한 해의 흐름`,
        sub: text(r.flow_profile_name) ?? DELETED,
        createdAt,
      };
    default:
      return null;
  }
}

/**
 * 오류 문의의 "문제가 생긴 서비스". 이용권을 쓴 기록(entitlements)과 무료인 관계 지도(maps)를
 * 최신순으로 섞고 끝에 "기타" 를 붙인다.
 *
 * subject_key 는 text 라 각 테이블의 id 를 ::text 로 맞춰 조인한다(profiles/store.ts 와 같은 방식).
 * 조인마다 user_id 를 같이 거는 이유: subject_key 는 FK 가 아니어서, 이론상 남의 행 id 와
 * 겹칠 수 있다 — 남의 이름이 내 목록에 찍히면 안 된다.
 *
 * 궁합의 subject_key 는 지금은 match id 다. 초기 설계(0013 주석)의 '12:34' 형식 행이 남아
 * 있다면 조인이 비어 "삭제된 항목" 으로 보인다 — 문의는 여전히 가능하다.
 */
export async function listServiceOptions(userId: string, client: SqlClient = sql): Promise<ServiceOption[]> {
  const [entRows, mapRows] = await Promise.all([
    client`
      SELECT e.feature, e.subject_key, e.created_at,
             p.name  AS profile_name,
             sp.name AS subject_name, cp.name AS counterpart_name,
             c.id    AS consult_id, c.title AS consult_title,
             f.flow_year, fp.name AS flow_profile_name
        FROM entitlements e
        LEFT JOIN profiles p
               ON e.feature = 'full_report' AND p.id::text = e.subject_key AND p.user_id = e.user_id
        LEFT JOIN matches m
               ON e.feature = 'compatibility' AND m.id::text = e.subject_key AND m.user_id = e.user_id
        LEFT JOIN profiles sp ON sp.id = m.subject_profile_id
        LEFT JOIN profiles cp ON cp.id = m.counterpart_profile_id
        LEFT JOIN consultations c
               ON e.feature = 'consultation' AND c.id::text = e.subject_key AND c.user_id = e.user_id
        LEFT JOIN flows f
               ON e.feature = 'yearly_flow' AND f.id::text = e.subject_key AND f.user_id = e.user_id
        LEFT JOIN profiles fp ON fp.id = f.profile_id
       WHERE e.user_id = ${userId}::bigint
       ORDER BY e.created_at DESC
       LIMIT ${OPTION_LIMIT}
    `,
    client`
      SELECT id, center_name, created_at
        FROM maps
       WHERE owner_user_id = ${userId}::bigint
    `,
  ]);

  const items: ServiceOption[] = [
    ...entRows.map(toServiceOption).filter((o): o is ServiceOption => o !== null),
    ...mapRows.map((r) => ({
      target: { kind: "map" as const, ref: String(r.id) },
      title: "관계 지도",
      sub: String(r.center_name),
      createdAt: toIso(r.created_at),
    })),
  ];
  // createdAt 은 모두 ISO(UTC) 라 문자열 비교가 곧 시간 비교다.
  items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return [...items.slice(0, OPTION_LIMIT), OTHER_OPTION];
}

function isPackageId(v: string): v is TicketPackageId {
  return (TICKET_PACKAGE_IDS as readonly string[]).includes(v);
}

/**
 * purchases 한 행 → 결제 내역 한 줄. 장수는 보너스를 포함한 적립 장수다 —
 * 카드 명세서의 주문명(packageOrderName)과 같은 숫자여야 사용자가 맞춰 볼 수 있다.
 */
export function toPurchaseOption(r: Record<string, unknown>): PurchaseOption {
  const product = String(r.product);
  const tickets =
    r.tickets != null ? Number(r.tickets) : isPackageId(product) ? creditedTickets(getPackage(product)) : null;
  const remaining = r.remaining == null ? 0 : Number(r.remaining);
  return {
    purchaseId: String(r.id),
    paymentId: String(r.payment_id ?? ""),
    title: tickets === null ? "이용권" : `이용권 ${tickets}장`,
    sub: `${Number(r.amount).toLocaleString("ko-KR")}원`,
    remaining,
    refundAmount: refundAmount({ amount: Number(r.amount), tickets, remaining }),
    createdAt: toIso(r.paid_at ?? r.created_at),
  };
}

/**
 * 환불 요청의 "환불 가능한 결제": paid · 남은 장수 있음 · 7일 이내를 SQL 로 거르고,
 * 환불액 0 원(쓴 장수를 정가로 치면 결제액을 넘는 묶음)은 앱에서 뺀다 — 가격 규칙은 refund.ts 가
 * 유일한 출처라 SQL 에 다시 적지 않는다. 실행(POST /api/refunds)도 같은 isRefundable 을 본다.
 *
 * tickets 가 NULL 인 옛 행은 isRefundable 이 뺀다(환불액 0) — 장수를 확신할 수 없는 결제는
 * 환불하지 않는다. toPurchaseOption 의 패키지 표 폴백은 표시용일 뿐이다.
 */
export async function listPurchaseOptions(
  userId: string,
  client: SqlClient = sql,
  now: Date = new Date(),
): Promise<PurchaseOption[]> {
  const rows = await client`
    SELECT p.id, p.payment_id, p.product, p.amount, p.tickets, p.remaining, p.status, p.paid_at, p.created_at
      FROM purchases p
     WHERE p.user_id = ${userId}::bigint
       AND p.status = 'paid'
       AND p.remaining > 0
       AND p.paid_at >= ${refundWindowStart(now)}
     ORDER BY p.paid_at DESC
     LIMIT ${OPTION_LIMIT}
  `;
  return rows
    .filter((r) =>
      isRefundable(
        {
          status: String(r.status),
          amount: Number(r.amount),
          tickets: r.tickets == null ? null : Number(r.tickets),
          remaining: r.remaining == null ? null : Number(r.remaining),
          paidAt: r.paid_at == null ? null : new Date(r.paid_at as string | Date),
        },
        now,
      ),
    )
    .map(toPurchaseOption);
}

export interface NewSupportTicket {
  userId: string;
  kind: SupportKind;
  targetKind: TargetKind | null;
  targetRef: string | null;
  /** 보낸 시점의 표시 문구. 서버가 목록을 다시 읽어 만든다 — 클라이언트 문구는 믿지 않는다. */
  targetLabel: string | null;
  purchaseId: string | null;
  refundReason: RefundReason | null;
  body: string;
  replyEmail: string | null;
  /** 자동 환불은 넣는 즉시 처리 끝이다 — 'resolved' 로 넣고 admin_note 에 금액을 남긴다. 기본 'open'. */
  status?: "open" | "resolved";
  adminNote?: string | null;
}

/**
 * 문의 한 건 저장. 같은 결제 건에 열린 환불 요청이 이미 있으면 0053 의 부분 유니크 인덱스에
 * 걸려 ON CONFLICT DO NOTHING 으로 접히고 null 을 돌려준다(호출자가 409 로 바꾼다).
 */
export async function insertSupportTicket(
  t: NewSupportTicket,
  client: SqlClient = sql,
): Promise<{ id: string; createdAt: string } | null> {
  const status = t.status ?? "open";
  const rows = await client`
    INSERT INTO support_tickets
      (user_id, kind, target_kind, target_ref, target_label, purchase_id, refund_reason, body, reply_email,
       status, admin_note, resolved_at)
    VALUES (
      ${t.userId}::bigint, ${t.kind}, ${t.targetKind}, ${t.targetRef}, ${t.targetLabel},
      ${t.purchaseId}::bigint, ${t.refundReason}, ${t.body}, ${t.replyEmail},
      ${status}, ${t.adminNote ?? null},
      CASE WHEN ${status} = 'resolved' THEN now() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id, created_at
  `;
  const row = rows[0];
  return row ? { id: String(row.id), createdAt: toIso(row.created_at) } : null;
}
