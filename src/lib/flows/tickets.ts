/**
 * 흐름을 볼 이용권이 없다.
 *
 * FlowRateLimitError 와 나란한 타입이다. 둘을 가르는 이유는 사용자에게 할 말이
 * 다르기 때문이다 — 한도는 기다리면 풀리지만 잔액 부족은 충전해야 한다.
 *
 * matches 의 MatchTicketsError 와 합치지 않는다. 합치면 flows 가 matches 를
 * import 하게 되는데 둘은 서로 모르는 기능이고, 각자의 화면이 각자의 에러를 다룬다.
 */
export class FlowTicketsError extends Error {
  constructor() {
    super("한 해의 흐름을 볼 이용권이 부족합니다");
    this.name = "FlowTicketsError";
  }
}
