import type { MessageRow } from "@/lib/consultations/store";

/** 화면에 그릴 한 발화. 저장 모양과 그리는 모양을 가르는 자리다 */
export interface ChatTurn {
  key: string;
  role: "user" | "counselor";
  bubbles: string[];
  /** 마지막 상담사 답에만 있다 */
  suggestions?: string[];
}

/**
 * 추천질문은 마지막 상담사 답의 것만 살린다. 지난 턴의 칩을 그대로 두면
 * 이미 흘러간 질문이 화면 아래에 되살아나 지금 대화와 어긋난다.
 */
export function toChatView(messages: MessageRow[]): ChatTurn[] {
  let lastCounselor = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "counselor") {
      lastCounselor = i;
      break;
    }
  }

  return messages.map((m, i) => {
    const suggestions = i === lastCounselor ? (m.suggestions ?? []) : [];
    return {
      key: m.id,
      role: m.role,
      bubbles: m.bubbles,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  });
}
