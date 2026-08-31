// 상담사 응답의 계약. tool 파라미터 스키마(모델에게 주는 것)와 파싱 스키마
// (돌아온 값을 믿기 전에 거는 것) 두 벌을 여기서 함께 관리한다 —
// 두 곳에 나눠 두면 반드시 어긋난다.

import { z } from "zod";

/** 응답을 강제할 tool 이름. 어댑터가 이 이름으로 tool 을 등록한다 */
export const COUNSEL_TOOL_NAME = "emit_reply";

/**
 * 말풍선 개수의 하한·상한.
 *
 * 상한이 5 였을 때 상담사가 리포트 한 단락을 다섯 조각으로 잘라 붙였다 — 채팅
 * 모양을 한 리포트지 대화가 아니었다(대화 설계 §20.1). 공감과 해석은 한 말풍선에
 * 묶이고, 제안이나 되묻기가 있을 때만 하나가 더 붙는다. 그래서 보통 1~2, 많아야 3이다.
 */
export const MIN_BUBBLES = 1;
export const MAX_BUBBLES = 3;
export const BUBBLE_MAX_CHARS = 120;

/**
 * 추천 답변의 **상한**이다. 하한은 0 이다 — 대화 설계 §18.
 *
 * 예전에는 minItems 도 이 값이라 중간 턴마다 정확히 두 개가 강제됐다. 그러면 낼
 * 갈래가 없는 턴에도 모델이 억지로 두 개를 지어내고, 그 대부분이 방금 한 제안에
 * 서명하게 만드는 문장("작은 것부터 다시 해볼게요")이 된다 — 상대의 상태를 묻는
 * 대신 내 결론을 받아들이게 하는 칩이다. 실제로 대화가 갈리는 자리에서만 낸다.
 */
export const MAX_SUGGESTIONS = 2;
export const SUGGESTION_MAX_CHARS = 30;
export const TITLE_MAX_CHARS = 20;

/**
 * 한 턴 응답의 출력 토큰 상한. 비용 상한의 두 번째 자물쇠다
 * (말풍선 3개 × 120자 + 추천 답변 2개 + 제목 ≈ 460자 ≈ 400토큰. 여유를 둔다).
 */
export const MAX_REPLY_TOKENS = 900;

export interface CounselorReply {
  bubbles: string[];
  suggestions: string[];
  title?: string;
  crisis: boolean;
  /**
   * 이 답이 사용자에게 되물어 답을 요구했는가. 모델이 스스로 표시한다.
   *
   * null 은 모델이 값을 안 준 경우다 — 그때만 다음 턴이 물음표로 짐작한다
   * (prompt.ts 의 askedLastTurn). false 와 다른 값이다: false 는 "되묻지 않았다"고
   * 모델이 **말한** 것이고, null 은 아무도 말하지 않은 것이다.
   */
  asksUser: boolean | null;
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
      description:
        "말풍선 하나는 한 호흡이다. 보통 한두 개 — 공감과 해석은 한 말풍선에 묶고, 제안이나 되묻기가 있을 때만 하나를 더 쓴다. 이어지는 말풍선이 같은 말을 되풀이하지 않는다.",
    },
    // 이름이 suggestions 가 아니라 user_replies 인 것이 이 필드의 방어선이다.
    // "제안"은 누구의 말인지 말해 주지 않아서, 모델이 상담사가 되묻는 질문을
    // 채워 넣었다("어떤 분야로 시작했어요?"). 그걸 누르면 사용자가 상담사에게
    // 그 질문을 하는 꼴이 된다. 저장·API 이름은 suggestions 그대로고, 여기서만
    // 갈린다 — parseReply 가 되돌려 준다.
    user_replies: {
      type: "array",
      minItems: 0,
      maxItems: opts.last ? 0 : MAX_SUGGESTIONS,
      items: { type: "string", maxLength: SUGGESTION_MAX_CHARS },
      description: opts.last
        ? "마지막 턴이므로 빈 배열로 둔다."
        : "사용자가 눌러서 자기 말로 보낼 다음 한마디. 대화가 실제로 갈리는 자리에서만 두 개를 내고, 갈래가 없으면 빈 배열로 둔다. 상담사가 상대에게 묻는 말이 아니다. 예: \"그럼 지금 옮겨도 될까요?\", \"아직 준비가 안 된 것 같아요\".",
    },
    crisis: {
      type: "boolean",
      description:
        "자해·자살·학대 신호를 읽고 사주 해석 대신 안내로 답했으면 true. 아니면 false.",
    },
    // 다음 턴이 연속 문진을 막는 근거다(대화 설계 §4). 말풍선 끝의 물음표로
    // 짐작하면 양쪽으로 틀리므로 — 물음표 없이 답을 요구하는 문장도, 물음표가
    // 있지만 되묻는 게 아닌 문장도 흔하다 — 답을 만든 쪽이 직접 표시한다.
    asks_user: {
      type: "boolean",
      ...(opts.last ? { enum: [false] } : {}),
      description: opts.last
        ? "마지막 턴이므로 되묻지 않는다. 반드시 false 다."
        : "이 답이 상대의 대답을 기다리는가. 물음표가 있느냐가 아니라 상대가 답해야 대화가 이어지느냐로 판단한다. \"어느 쪽이 더 가까운지 말해줘요\" 는 물음표가 없어도 true, \"'내가 왜 이러지?' 하는 생각이 들 수 있어요\" 는 물음표가 있어도 false.",
    },
  };

  const required = ["bubbles", "user_replies", "crisis", "asks_user"];

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
  user_replies: z.array(z.string().trim().min(1)).max(MAX_SUGGESTIONS).default([]),
  title: z.string().trim().min(1).max(TITLE_MAX_CHARS).optional(),
  // 빠지면 false. 없다고 무료 턴을 주면 미차감 한도를 우회하는 길이 된다.
  crisis: z.boolean().default(false),
  // 여기는 default 를 두지 않는다 — 빠진 것은 "되묻지 않았다"가 아니라 모른다는
  // 뜻이고, 그 구분이 있어야 다음 턴이 물음표 짐작으로 물러설 수 있다.
  asks_user: z.boolean().optional(),
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
    suggestions: opts.last ? [] : parsed.user_replies.slice(0, MAX_SUGGESTIONS),
    ...(opts.first && parsed.title ? { title: parsed.title } : {}),
    crisis: parsed.crisis,
    // 마지막 턴은 되묻지 않는 턴이라 모델이 뭐라 하든 false 다. 그 뒤에 다음 턴이
    // 없으므로 읽힐 일도 없지만, 저장된 값이 화면과 어긋나 있으면 안 된다.
    asksUser: opts.last ? false : (parsed.asks_user ?? null),
  };
}
