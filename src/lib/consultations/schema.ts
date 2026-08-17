// 상담사 응답의 계약. tool 파라미터 스키마(모델에게 주는 것)와 파싱 스키마
// (돌아온 값을 믿기 전에 거는 것) 두 벌을 여기서 함께 관리한다 —
// 두 곳에 나눠 두면 반드시 어긋난다.

import { z } from "zod";

/** 응답을 강제할 tool 이름. 어댑터가 이 이름으로 tool 을 등록한다 */
export const COUNSEL_TOOL_NAME = "emit_reply";

export const MIN_BUBBLES = 2;
export const MAX_BUBBLES = 5;
export const BUBBLE_MAX_CHARS = 120;
export const SUGGESTION_COUNT = 2;
export const SUGGESTION_MAX_CHARS = 30;
export const TITLE_MAX_CHARS = 20;

/**
 * 한 턴 응답의 출력 토큰 상한. 비용 상한의 두 번째 자물쇠다
 * (말풍선 5개 × 120자 + 추천질문 2개 + 제목 ≈ 700자 ≈ 600토큰. 여유를 둔다).
 */
export const MAX_REPLY_TOKENS = 900;

export interface CounselorReply {
  bubbles: string[];
  suggestions: string[];
  title?: string;
  crisis: boolean;
}

export interface ReplyOptions {
  /** 첫 턴이면 제목을 함께 받는다 */
  first: boolean;
  /** 마지막 턴이면 추천질문을 받지 않는다 */
  last: boolean;
}

/**
 * 모델에게 줄 tool 파라미터 스키마. 개수를 여기 박는 것이 유일한 방어선이다 —
 * 프롬프트로 "두 개만 주세요"라고 부탁하면 지켜지지 않는 날이 온다.
 */
export function replyToolSchema(opts: ReplyOptions): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    bubbles: {
      type: "array",
      minItems: MIN_BUBBLES,
      maxItems: MAX_BUBBLES,
      items: { type: "string", maxLength: BUBBLE_MAX_CHARS },
      description: "말풍선 하나는 한 호흡이다. 이어지는 말풍선이 같은 말을 되풀이하지 않는다.",
    },
    suggestions: {
      type: "array",
      minItems: opts.last ? 0 : SUGGESTION_COUNT,
      maxItems: opts.last ? 0 : SUGGESTION_COUNT,
      items: { type: "string", maxLength: SUGGESTION_MAX_CHARS },
      description: opts.last
        ? "마지막 턴이므로 빈 배열로 둔다."
        : "사용자가 이어서 물어볼 만한 짧은 질문 두 개. 사용자의 말투로 쓴다.",
    },
    crisis: {
      type: "boolean",
      description:
        "자해·자살·학대 신호를 읽고 사주 해석 대신 안내로 답했으면 true. 아니면 false.",
    },
  };

  const required = ["bubbles", "suggestions", "crisis"];

  if (opts.first) {
    properties.title = {
      type: "string",
      maxLength: TITLE_MAX_CHARS,
      description: "이 상담을 목록에서 알아볼 짧은 제목. 사용자의 고민을 명사구로 줄인다.",
    };
    required.push("title");
  }

  return { type: "object", properties, required };
}

const replyShape = z.object({
  bubbles: z.array(z.string().trim().min(1)).min(MIN_BUBBLES).max(MAX_BUBBLES),
  suggestions: z.array(z.string().trim().min(1)).max(SUGGESTION_COUNT).default([]),
  title: z.string().trim().min(1).max(TITLE_MAX_CHARS).optional(),
  // 빠지면 false. 없다고 무료 턴을 주면 미차감 한도를 우회하는 길이 된다.
  crisis: z.boolean().default(false),
});

/**
 * 제목이 빠진 첫 턴 응답을 메운다. 사용자 발화 앞부분을 잘라 쓴다.
 *
 * 모델이 title 을 안 주는 것을 실패로 볼 수도 있지만, 그러면 parseReply 가 던지고
 * openConsultation 이 이용권을 되돌려 상담이 아예 안 열린다 — 제목 한 줄 때문에
 * 치를 대가가 아니다. 목록에서 알아볼 수만 있으면 된다.
 */
export function fallbackTitle(utterance: string): string {
  // 스프레드로 자르는 이유: 서로게이트 쌍이 반으로 잘리지 않게
  // (src/app/home/_lib/to-home-entry.ts 의 initialOf 와 같은 이유).
  const chars = [...utterance.trim()];
  return chars.length <= TITLE_MAX_CHARS
    ? chars.join("")
    : `${chars.slice(0, TITLE_MAX_CHARS - 1).join("")}…`;
}

/**
 * 돌아온 tool 인자를 믿기 전에 한 번 거른다. 던지면 그 턴은 실패로 처리되고
 * 차감되지 않는다 — 깨진 응답에 이용권을 쓰게 두지 않는다.
 * 개수·필수 강제는 여기 걸지 않는다 — tool 스키마 쪽에만 둔다. 모양이 깨진 응답만 거른다.
 */
export function parseReply(raw: unknown, opts: ReplyOptions): CounselorReply {
  const parsed = replyShape.parse(raw);
  return {
    bubbles: parsed.bubbles,
    // 마지막 턴에 추천질문이 와도 버린다. 스키마로 막았지만 모델이 넘겨도
    // 화면에 "더 물어보세요"가 뜨는 일은 없어야 한다.
    suggestions: opts.last ? [] : parsed.suggestions.slice(0, SUGGESTION_COUNT),
    ...(opts.first && parsed.title ? { title: parsed.title } : {}),
    crisis: parsed.crisis,
  };
}
