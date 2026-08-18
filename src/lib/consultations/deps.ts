import { createDeepSeekChatTransport } from "./chat-transport";
import { CONSULT_MODEL } from "./model";
import { InsufficientTicketsError, type TicketPort } from "./ticket-port";
import {
  appendMessage,
  commitTurn,
  createConsultation,
  getConsultation,
  listMessages,
  setTicketSpent,
} from "./store";
import type { ServiceDeps } from "./service";
import { getBalance } from "@/lib/tickets/wallet";
import { refundTicket } from "@/lib/tickets/refund";
import { spendTicket } from "@/lib/tickets/spend";

/**
 * 이용권 모듈과 상담 사이의 어댑터.
 *
 * 존재 이유는 에러 변환 하나다. spendTicket 은 결과를 돌려주지만 service.ts 의
 * openConsultation 은 spend 가 **던지는 것**에 의존해 흐름을 짠다 — 던지면
 * setTicketSpent(true) 에 닿지 않아 값을 치르지 않은 상담이 목록에 뜨지 않는다.
 * 라우트도 InsufficientTicketsError 만 402 로 바꾼다.
 *
 * deps 를 주입받는 이유: 이 변환이 실제로 일어나는지 DB 없이 테스트하려면
 * 안쪽 세 함수를 갈아 끼울 수 있어야 한다.
 */
export interface TicketDeps {
  getBalance: typeof getBalance;
  spend: typeof spendTicket;
  refund: typeof refundTicket;
}

const FEATURE = "consultation" as const;

export function makeTicketPort(d: TicketDeps): TicketPort {
  return {
    getBalance: (userId) => d.getBalance(userId),

    // consultationId 가 그대로 subject_key 다 — 상담 1건이 차감 단위이므로
    // entitlements_unique 가 같은 상담에 두 번 차감되는 것을 막는다.
    // already 는 성공이다: 이미 값을 치른 상담을 다시 여는 것뿐이다.
    spend: async (userId, consultationId) => {
      const r = await d.spend({ userId, feature: FEATURE, subjectKey: consultationId });
      if (!r.ok) throw new InsufficientTicketsError();
    },

    // nothing_to_refund 를 삼킨다 — "되돌릴 것이 없다"는 실패가 아니라
    // 이미 되돌아간 상태다. 실제 장애는 refundTicket 이 예외로 올린다.
    refund: async (userId, consultationId) => {
      await d.refund({ userId, feature: FEATURE, subjectKey: consultationId });
    },
  };
}

const liveTicketPort = makeTicketPort({
  getBalance,
  spend: spendTicket,
  refund: refundTicket,
});

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let cached: ServiceDeps | undefined;

export function consultationDeps(): ServiceDeps {
  if (cached) return cached;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  cached = {
    store: {
      createConsultation,
      getConsultation,
      listMessages,
      appendMessage,
      commitTurn,
      setTicketSpent,
    },
    tickets: liveTicketPort,
    transport: createDeepSeekChatTransport({ apiKey }),
    model: CONSULT_MODEL,
  };
  return cached;
}
