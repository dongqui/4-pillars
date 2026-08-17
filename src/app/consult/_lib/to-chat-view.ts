import type { MessageRow } from "@/lib/consultations/store";

/** 화면에 그릴 한 발화. 저장 모양과 그리는 모양을 가르는 자리다 */
export interface ChatTurn {
  key: string;
  role: "user" | "counselor";
  bubbles: string[];
  /** 마지막 상담사 답에만 있다 */
  suggestions?: string[];
  /**
   * 진입 애니메이션(pv-bubble-in)을 태울지만 결정한다 — 그 외 아무 의미도 없다.
   * toChatView 는 복원된 이력만 만들므로 항상 false 다. 방금 API 에서 온 상담사
   * 답을 ChatRoom 이 이어붙일 때만 true 로 준다. 문자열 키 접두사로 새 턴을
   * 구분하던 방식은 깨지기 쉬워 이 플래그로 대체했다.
   */
  isNew: boolean;
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
      isNew: false,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  });
}
