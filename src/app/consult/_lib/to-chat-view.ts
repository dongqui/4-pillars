import type { MessageRow } from "@/lib/consultations/store";

/** 화면에 그릴 한 발화. 저장 모양과 그리는 모양을 가르는 자리다 */
export interface ChatTurn {
  key: string;
  role: "user" | "counselor";
  bubbles: string[];
  /**
   * 진입 애니메이션(pv-bubble-in)을 태울지만 결정한다 — 그 외 아무 의미도 없다.
   * toChatView 는 복원된 이력만 만들므로 항상 false 다. 방금 API 에서 온 상담사
   * 답을 ChatRoom 이 이어붙일 때만 true 로 준다. 문자열 키 접두사로 새 턴을
   * 구분하던 방식은 깨지기 쉬워 이 플래그로 대체했다.
   */
  isNew: boolean;
}

export function toChatView(messages: MessageRow[]): ChatTurn[] {
  return messages.map((m) => ({
    key: m.id,
    role: m.role,
    bubbles: m.bubbles,
    isNew: false,
  }));
}
