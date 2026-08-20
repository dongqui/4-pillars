/**
 * 이용권 충전 패키지. 주문 생성 API 가 이 표에서 청구 금액과 적립 장수를 박고,
 * 화면은 읽기만 한다 — 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 * amount 를 tickets × 1000 으로 계산하지 않는 이유: 표시용 단가와 실제 청구 금액은
 * 언제든 갈라질 수 있고(프로모션, 반올림), 청구 금액은 파생값이 아니라 명시값이어야
 * 한다. 반대로 적립 장수는 파생값이라 creditedTickets 한 곳에서만 더한다.
 */

/**
 * 순서가 곧 화면 순서다. 타입을 배열에서 파생시키는 이유는 PAYMENT_METHOD_IDS 와
 * 같다 — 배열과 유니온을 따로 적으면 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다.
 */
export const TICKET_PACKAGE_IDS = ["t1", "t5", "t10"] as const;

export type TicketPackageId = (typeof TICKET_PACKAGE_IDS)[number];

export interface TicketPackage {
  id: TicketPackageId;
  /** 실제 청구 금액(원). 명시값이다. */
  amount: number;
  /** 기본 장수 */
  tickets: number;
  /** 묶음 보너스. 화면이 "+N장 더"를 그릴 수 있게 따로 둔다. */
  bonus: number;
}

/**
 * Record 인 이유: id 를 추가하면 여기서 컴파일이 깨진다. 배열로 두면 항목 하나를
 * 빠뜨려도 통과하고, 그 패키지는 런타임에 undefined 로 나타난다.
 */
const PACKAGES: Record<TicketPackageId, Omit<TicketPackage, "id">> = {
  t1: { amount: 1000, tickets: 1, bonus: 0 },
  t5: { amount: 5000, tickets: 5, bonus: 1 },
  t10: { amount: 10000, tickets: 10, bonus: 3 },
};

export function getPackage(id: TicketPackageId): TicketPackage {
  return { id, ...PACKAGES[id] };
}

/** 화면 순서대로. */
export function listPackages(): TicketPackage[] {
  return TICKET_PACKAGE_IDS.map(getPackage);
}

/** 실제로 지갑에 들어가는 장수. 적립·표시·주문명이 전부 이 함수를 지난다. */
export function creditedTickets(p: TicketPackage): number {
  return p.tickets + p.bonus;
}

/**
 * 결제창·카드 명세서·토스 콘솔에 뜨는 상품명.
 * 프로필 이름을 넣지 않는 기존 판단을 잇는다 — 명세서에 타인의 이름이 남을 이유가 없다.
 */
export function packageOrderName(p: TicketPackage): string {
  return `이용권 ${creditedTickets(p)}장`;
}
