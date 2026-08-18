/**
 * 궁합 생성에 쓸 이용권이 없다.
 *
 * MatchRateLimitError 와 나란한 타입이다. 둘을 가르는 이유는 사용자에게 할 말이
 * 다르기 때문이다 — 한도는 기다리면 풀리지만 잔액 부족은 충전해야 한다.
 *
 * consultations 의 InsufficientTicketsError 와 합치지 않는다. 합치면 matches 가
 * consultations 를 import 하게 되는데 둘은 서로 모르는 기능이고, 각자의 화면이
 * 각자의 에러를 다룬다.
 */
export class MatchTicketsError extends Error {
  constructor() {
    super("궁합을 볼 이용권이 부족합니다");
    this.name = "MatchTicketsError";
  }
}
