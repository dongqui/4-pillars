/**
 * 고객 문의(오류 · 피드백 · 환불) 의 공용 타입과 순수 함수.
 *
 * 클라이언트(SupportDialog)와 서버(store · handler)가 같이 import 한다 — 그래서 여기에는
 * db·redis 처럼 서버에서만 도는 것을 들이지 않는다.
 *
 * 배열에서 타입을 파생시키는 이유는 TICKET_PACKAGE_IDS 와 같다: 배열과 유니온을 따로
 * 적으면 한쪽만 고쳐도 컴파일이 통과해 zod 검증과 타입이 조용히 어긋난다.
 */
export const SUPPORT_KINDS = ["error", "feedback", "refund"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

/** support_tickets.target_kind 의 CHECK 와 같은 목록이다(0050). */
export const TARGET_KINDS = [
  "full_report",
  "compatibility",
  "consultation",
  "yearly_flow",
  "map",
  "other",
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** 시안의 칩 문구 그대로. DB 에는 CHECK 가 없다 — 이 목록이 유일한 검증이다. */
export const REFUND_REASONS = [
  "실수로 결제했어요",
  "결과가 나오지 않아요",
  "내용이 기대와 달라요",
  "기타",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const BODY_MAX = 4000;

export interface ServiceTarget {
  kind: TargetKind;
  /** "기타" 만 null 이다. */
  ref: string | null;
}

/** 오류 문의의 "문제가 생긴 서비스" 한 줄. */
export interface ServiceOption {
  target: ServiceTarget;
  title: string;
  sub: string;
  /** ISO 문자열. "기타" 는 null. */
  createdAt: string | null;
}

/** 환불 요청의 "환불 가능한 결제" 한 줄. 서버가 isRefundable 로 거른 것만 내려온다. */
export interface PurchaseOption {
  purchaseId: string;
  paymentId: string;
  title: string;
  sub: string;
  /** 아직 안 쓴 장수 — 전부 회수된다. */
  remaining: number;
  /** 지금 환불받을 금액(원). 서버가 계산한 표시용이다 — 실행 때 다시 계산한다. */
  refundAmount: number;
  createdAt: string;
}

export type SupportOptions =
  | { kind: "error"; items: ServiceOption[] }
  | { kind: "refund"; items: PurchaseOption[]; balance: number };

export const OTHER_OPTION: ServiceOption = {
  target: { kind: "other", ref: null },
  title: "기타",
  sub: "목록에 없는 문제예요",
  createdAt: null,
};

export function serviceKey(t: ServiceTarget): string {
  return `${t.kind}:${t.ref ?? ""}`;
}

export function optionLabel(o: { title: string; sub: string }): string {
  return `${o.title} · ${o.sub}`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 자정의 epoch ms. 사용자가 보는 "오늘" 은 서버 시간대가 아니라 한국 날짜다. */
function kstDay(d: Date): { start: number; month: number; date: number } {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    start: Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()),
    month: k.getUTCMonth() + 1,
    date: k.getUTCDate(),
  };
}

/** 목록 오른쪽 메타: 오늘 / 어제 / M월 D일. */
export function formatOptionDate(iso: string | null, now: Date): string {
  if (iso === null) return "";
  const a = kstDay(new Date(iso));
  const b = kstDay(now);
  const diff = Math.round((b.start - a.start) / DAY_MS);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return `${a.month}월 ${a.date}일`;
}

/**
 * 보내기 버튼 활성 조건 — 시안의 `ready` 그대로. 서버 검증(handler 의 zod)과 같은 판단이어야
 * 한다: 버튼은 켜졌는데 400 이 오면 사용자는 무엇이 틀렸는지 알 길이 없다.
 */
export function canSubmit(
  kind: SupportKind,
  s: { pick: string | null; reason: RefundReason | null; text: string },
): boolean {
  const hasText = s.text.trim().length > 0;
  if (kind === "error") return s.pick !== null && hasText;
  if (kind === "refund") return s.pick !== null && s.reason !== null;
  return hasText;
}

/** 환불 탭 상단 정책. 결제 화면(CheckoutView)의 안내와 같은 규칙을 말한다. */
export const REFUND_POLICY = [
  "결제일로부터 7일 이내, 사용하지 않은 이용권만 환불돼요.",
  "쓴 장수는 장당 1,000원으로 계산하고, 보너스 장수는 환불되지 않아요.",
] as const;

export function refundButtonLabel(amount: number | null): string {
  return amount === null ? "환불받기" : `${amount.toLocaleString("ko-KR")}원 환불받기`;
}

/** pending 은 포트원 취소가 실패해 운영자가 마저 처리하는 경우 — 유저에게는 "접수" 로 보인다. */
export function refundSentDesc(amount: number, pending: boolean): string {
  if (pending) return "환불을 접수했어요. 처리에 시간이 걸릴 수 있어요.";
  return `${amount.toLocaleString("ko-KR")}원이 결제하신 수단으로 돌아가요. 카드사에 따라 3~7일 걸려요.`;
}
