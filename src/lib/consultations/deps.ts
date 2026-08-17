import { createDeepSeekChatTransport } from "./chat-transport";
import { CONSULT_MODEL } from "./model";
import { stubTicketPort } from "./ticket-port";
import {
  appendMessage,
  commitTurn,
  createConsultation,
  getConsultation,
  listMessages,
} from "./store";
import type { ServiceDeps } from "./service";

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let cached: ServiceDeps | undefined;

export function consultationDeps(): ServiceDeps {
  if (cached) return cached;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  cached = {
    store: { createConsultation, getConsultation, listMessages, appendMessage, commitTurn },
    // 이용권 배선 전이다. spend 가 던지므로 상담 개설은 아직 실패한다 —
    // 의도된 상태다 (ticket-port.ts 주석 참고).
    tickets: stubTicketPort,
    transport: createDeepSeekChatTransport({ apiKey }),
    model: CONSULT_MODEL,
  };
  return cached;
}
