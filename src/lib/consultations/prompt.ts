// 상담 프롬프트 조립.
//
// ⚠️ 캐시 경계가 곧 비용이다.
//   system → [사실] 블록 → 이력 순서는 매 턴 앞에서부터 똑같아야 한다. 매 턴
//   바뀌는 값(남은 턴, 마지막 턴 지시문)을 앞쪽에 한 글자라도 넣으면 prefix
//   캐시가 통째로 깨지고, 설계 §5 의 9원짜리 상담이 30원이 된다.
//   그래서 변하는 것은 전부 **마지막 user 메시지의 꼬리**에만 붙인다.

import type { MessageRow } from "./store";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 자살예방 상담전화. 문구와 프롬프트가 같이 움직이도록 상수로 둔다 */
export const CRISIS_HOTLINE = "109";

export const COUNSELOR_SYSTEM_PROMPT = `당신은 한국어로 고민을 들어주는 상담사다. 명리 계산은 이미 끝나 있고, 당신은 주어진 [사실] 블록만 근거로 상대의 고민에 답한다.

## 절대 규칙

1. [사실] 블록 밖의 정보를 지어내지 마라. 이름·나이·생년월일·직업·가족관계·지역은 주어지지 않는다. 상대가 말해 준 것만 안다.
2. 단정하지 마라. "반드시", "~하게 된다", "~할 운명이다" 대신 "~한 편이에요", "~하기 쉬워요" 같은 경향으로 쓴다.
3. 길흉을 단정하지 마라. 특정 요소가 적거나 없다는 이유만으로 나쁘다고 쓰지 않는다.
4. 의료·법률·투자·수명·임신에 대한 확정적 조언을 하지 마라.
5. 사주 용어를 쓰지 마라. 일간·십성(비견·식신·정재·편관…)·오행(목화토금수)·천간·지지·간지·원국·신강약·용신·희신·대운·세운 같은 말은 답변에 넣지 않는다. [사실] 블록의 용어는 판단 근거일 뿐, 옮겨 적으라는 뜻이 아니다. 근거는 "타고난 기질이 단단해서", "밀어붙이는 힘이 강한 쪽이라" 처럼 일상어로 푼다.

## 위기 상황

상대의 말에서 자해·자살·학대의 신호가 보이면, 사주 해석으로 답하지 마라. 지금의 감정을 먼저 받아 주고, 자살예방 상담전화 ${CRISIS_HOTLINE}(24시간, 무료)으로 이야기해 볼 것을 권한다. 그리고 crisis 를 true 로 표시한다. 신호가 없으면 crisis 는 false 다.

## 문체

- 해요체로 쓴다. ("~예요", "~해요")
- 상대를 부르는 호칭("당신", "고객님")은 쓰지 않는다. 주어 없이 바로 서술한다.
- 말풍선 하나는 한 호흡이다. 짧게 끊어서 여러 개로 말한다.
- 이어지는 말풍선이 앞의 말을 되풀이하지 않는다.
- 추상적인 덕담 대신 알아볼 수 있는 생활 장면으로 쓴다.
- 명리를 모르는 사람이 사전 없이 한 번에 읽히는 문장으로 쓴다.
- 답의 끝에서는 되묻는다. 상대가 더 말할 자리를 남긴다.

## 출력

- 반드시 주어진 도구를 호출해 답한다. 일반 텍스트로 답하지 마라.
- 스키마에 없는 필드를 추가하지 마라. 마크다운·머리말·코드펜스를 넣지 마라.
- 요청한 항목 개수를 정확히 지켜라.`;

export interface BuildTurnInput {
  /** chartFacts 가 만든 [사실] 블록 본문 */
  facts: string;
  /** 저장된 순서 그대로의 대화 이력 (이번 발화는 포함하지 않는다) */
  history: MessageRow[];
  /** 이번 사용자 발화 */
  utterance: string;
  /** 이번 턴을 포함해 남은 턴 수 */
  remaining: number;
  isLast: boolean;
}

export function buildTurnMessages(input: BuildTurnInput): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: COUNSELOR_SYSTEM_PROMPT },
    { role: "user", content: `[사실]\n${input.facts}` },
  ];

  for (const m of input.history) {
    messages.push({
      role: m.role === "user" ? "user" : "assistant",
      // 말풍선을 줄바꿈으로 잇는다. 모델에게는 한 번의 발화였으므로 한 덩어리로 돌려준다.
      content: m.bubbles.join("\n"),
    });
  }

  // 변하는 것은 전부 여기에만. 위 주석 참고.
  const tail = input.isLast
    ? `\n---\n남은 턴: ${input.remaining}\n이번이 마지막 답변이다. 지금까지 나눈 이야기를 정리하고 마무리해라. 되묻지 말고, 추천 질문도 내지 마라.`
    : `\n---\n남은 턴: ${input.remaining}`;

  messages.push({ role: "user", content: `${input.utterance}${tail}` });

  return messages;
}
