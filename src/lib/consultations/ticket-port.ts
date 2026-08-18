// 이용권 모듈과의 경계.
//
// 이 자리는 이제 채워졌다 — src/lib/consultations/deps.ts 의 makeTicketPort/
// liveTicketPort 가 이 인터페이스를 spendTicket/refundTicket/getBalance 로 구현해
// openConsultation 에 배선한다. 여기 남은 TicketPort 인터페이스와
// InsufficientTicketsError 는 그 배선이 지키는 계약이고, stubTicketPort 는
// 실구현이 없던 시절의 흔적이 아니라 ticket-port.test.ts 가 여전히 쓰는
// 테스트 더블이다 — 지우거나 배선에 다시 끼우지 않는다.

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
 * 배선 전 시절의 스텁. 지금은 openConsultation 이 이 스텁이 아니라
 * deps.ts 의 liveTicketPort 를 쓴다 — 아래 동작 차이는 배선 전 안전장치였던
 * 이유를 남겨 두는 기록이고, ticket-port.test.ts 가 그 계약(둘의 동작이
 * 다르다는 것)을 여전히 검증한다.
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
