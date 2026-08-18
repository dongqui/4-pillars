// 이용권 모듈과의 경계. 이 파일 하나가 다른 세션과의 유일한 접점이다.
//
// 이용권 시스템(구매·잔액·원장)은 별도 작업이고 이 기능의 범위 밖이다. 여기서는
// 고민상담이 필요로 하는 세 가지 동작의 타입만 선언하고, 구현은 그 작업이 끝난 뒤
// stubTicketPort 를 실구현으로 갈아 끼운다.

/** 잔액이 부족할 때. 라우트는 이 에러만 402 로 바꾼다 */
export class InsufficientTicketsError extends Error {
  constructor() {
    super("이용권이 부족합니다");
    this.name = "InsufficientTicketsError";
  }
}

export interface TicketPort {
  getBalance(userId: string): Promise<number>;
  /**
   * 이용권 한 장을 쓴다. 잔액이 없으면 InsufficientTicketsError 를 던진다.
   * consultationId 는 멱등키 자리다 — 어떻게 구현하든 같은 상담에 두 번
   * 차감되지 않게 할 손잡이가 필요하다.
   */
  spend(userId: string, consultationId: string): Promise<void>;
  refund(userId: string, consultationId: string): Promise<void>;
}

/**
 * 배선 전 스텁. 동작이 갈리는 것은 의도된 것이다.
 *
 * - spend/refund 는 **던진다**. 배선 전에 상담이 공짜로 열리면 안 되고,
 *   던져야 그 사실이 즉시 드러난다.
 * - getBalance 는 0 을 돌려준다. 던지면 목록 화면 전체가 500 이 되어
 *   개발 중에 아무것도 볼 수 없다. 대신 이 0 을 화면에 숫자로 표시하지는
 *   않는다 (설계 §4-b) — 스텁의 0 을 "0장"이라고 보여주면 거짓말이 된다.
 */
export const stubTicketPort: TicketPort = {
  getBalance: async () => 0,
  spend: async () => {
    throw new Error("이용권 차감이 아직 배선되지 않았습니다 (ticket-port.ts)");
  },
  refund: async () => {
    throw new Error("이용권 되돌리기가 아직 배선되지 않았습니다 (ticket-port.ts)");
  },
};
