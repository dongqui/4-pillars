// 상담사 응답의 계약. tool 파라미터 스키마(모델에게 주는 것)와 파싱 스키마
// (돌아온 값을 믿기 전에 거는 것) 두 벌을 여기서 함께 관리한다 —
// 두 곳에 나눠 두면 반드시 어긋난다.

import { z } from "zod";

/** 응답을 강제할 tool 이름. 어댑터가 이 이름으로 tool 을 등록한다 */
export const COUNSEL_TOOL_NAME = "emit_reply";

/**
 * 말풍선 개수의 하한. 상한은 두지 않는다.
 *
 * 상한 3 을 두었을 때(2026-09-16 개편 직후) 답이 길어지자 모델이 말풍선을 4개로
 * 나눠 보냈고, DeepSeek 는 tool 스키마의 maxItems 를 강제하지 않아 그 턴이 파싱에서
 * 통째로 버려졌다 — 첫 턴이면 이용권이 되돌려지고 상담이 안 열린다. 말풍선 몇 개
 * 때문에 치를 대가가 아니다. 쪼개기는 프롬프트(보통 두세 개)로 이끌고, 전체 길이는
 * MAX_REPLY_TOKENS 가 묶는다.
 */
export const MIN_BUBBLES = 1;

/**
 * 말풍선 하나의 글자 상한.
 *
 * 120 이었을 때는 새 고민 답의 목표(전체 650~1,000자, 2026-09-16 개편)를 담을 수
 * 없었다. 두 말풍선으로 1,000자를 담고도 남도록 잡는다.
 */
export const BUBBLE_MAX_CHARS = 600;
export const TITLE_MAX_CHARS = 20;

/**
 * 한 답이 댈 수 있는 해석 기준의 수와, 그 주장 한 문장의 길이.
 *
 * 3 인 이유: 한 답이 네 갈래 근거를 동시에 쓰면 그건 근거가 아니라 나열이다.
 * 0 도 정상이다 — 관련 기준이 없는데 억지로 고르게 하면 끼워 맞추기가 돌아온다.
 */
export const MAX_BASIS = 3;
export const BASIS_CLAIM_MAX_CHARS = 120;

/**
 * 한 턴 응답의 출력 토큰 상한. 비용 상한의 두 번째 자물쇠다
 * 말풍선 개수에 상한이 없으므로 답 전체 길이를 묶는 것은 이 값뿐이다.
 * 실측(2026-09-16, deepseek-v4-pro)으로 600자 안팎의 답이 500토큰 안팎이었다 —
 * 2400 이면 약 3,000자로, 목표 분량(보통 1,000자 이하)이 잘리지 않고 남는다.
 */
export const MAX_REPLY_TOKENS = 2400;

/** 이 답이 어떤 해석 기준에 기대 무엇을 주장했는지. 내부 확인용이다 */
export interface BasisRef {
  criterionId: string;
  claim: string;
}

export interface CounselorReply {
  bubbles: string[];
  /**
   * 사용한 해석 기준. 기준 블록이 없거나 사주로 설명하지 않은 턴에는 빈 배열이다.
   *
   * 모델이 돌려준 것을 **그대로** 담는다. MAX_BASIS 를 넘겨도 자르지 않는다 —
   * 조용히 잘라 두면 평가할 때 그 누락이 모델에서 생긴 것인지 우리 후처리에서
   * 생긴 것인지 구분할 수 없다. 넘쳤다는 사실은 basisOverflow 가 말한다.
   *
   * ⚠️ 이 값이 채워졌다고 본문이 그 기준을 지켰다는 뜻은 아니다. id 가 실재하는지는
   * 셀 수 있어도, 본문이 그 기준의 방향·조건·범위 안에 있는지는 사람이 본다.
   */
  basis: BasisRef[];
  /** 모델이 MAX_BASIS 보다 많이 댔는가. 기록용이다 — 그 턴을 버리지 않는다 */
  basisOverflow: boolean;
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
  /** 마지막 턴이면 되묻지 않는다 */
  last: boolean;
}

/**
 * 모델에게 줄 tool 파라미터 스키마. 개수를 여기 박는 것이 유일한 방어선이다 —
 * 프롬프트로 "하나는 꼭 주세요"라고 부탁하면 지켜지지 않는 날이 온다.
 */
export function replyToolSchema(opts: ReplyOptions): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    bubbles: {
      type: "array",
      minItems: MIN_BUBBLES,
      items: { type: "string", maxLength: BUBBLE_MAX_CHARS },
      description:
        "의미가 이어지는 설명은 한 말풍선에 묶고, 적용이나 제안으로 넘어갈 때 나눈다. 보통 두세 개. 문장마다 끊지 않으며, 한 말풍선 안에서도 문단을 나눌 수 있다. 이어지는 말풍선이 같은 말을 되풀이하지 않는다.",
    },
    // 근거를 답과 같은 호흡에 적게 하는 것이 이 필드의 목적이다. 나중에 붙이는
    // 설명이 아니라, 무엇에 기대 말하는지를 먼저 고르게 한다.
    basis: {
      type: "array",
      minItems: 0,
      maxItems: MAX_BASIS,
      items: {
        type: "object",
        properties: {
          criterion_id: {
            type: "string",
            description: "[해석 기준] 블록에 있는 id 를 그대로 적는다. 없는 id 를 만들지 않는다.",
          },
          claim: {
            type: "string",
            maxLength: BASIS_CLAIM_MAX_CHARS,
            description: "그 기준으로 뒷받침하려는 이번 답의 핵심 주장 한 문장.",
          },
        },
        required: ["criterion_id", "claim"],
      },
      description:
        "이 답이 실제로 기댄 해석 기준. 사주로 설명하지 않았거나 맞는 기준이 없으면 빈 배열로 둔다. 답을 만들려고 무관한 기준을 고르지 않는다.",
    },
    crisis: {
      type: "boolean",
      description:
        "자해·자살·학대 등 안전 위기 신호를 읽고 운세 풀이 대신 안전 안내로 답했으면 true. 아니면 false.",
    },
    // 다음 턴이 연속 문진을 막는 근거다(대화 설계 §4). 말풍선 끝의 물음표로
    // 짐작하면 양쪽으로 틀리므로 — 물음표 없이 답을 요구하는 문장도, 물음표가
    // 있지만 되묻는 게 아닌 문장도 흔하다 — 답을 만든 쪽이 직접 표시한다.
    asks_user: {
      type: "boolean",
      ...(opts.last ? { enum: [false] } : {}),
      description: opts.last
        ? "마지막 턴이므로 되묻지 않는다. 반드시 false 다."
        : "사용자에게 확인이나 대답을 요청하면 true. 물음표 유무만으로 판단하지 않는다. \"어느 쪽이 더 가까운지 말해줘요\" 는 물음표가 없어도 true, \"'내가 왜 이러지?' 하는 생각이 들 수 있어요\" 는 물음표가 있어도 false.",
    },
  };

  const required = ["bubbles", "basis", "crisis", "asks_user"];

  if (opts.first) {
    properties.title = {
      type: "string",
      maxLength: TITLE_MAX_CHARS,
      description: "이 상담을 목록에서 알아볼 짧은 제목. 사용자가 실제로 말한 고민을 명사구로 줄인다. 해석에서 추측한 문제는 넣지 않는다.",
    };
    required.push("title");
  }

  return { type: "object", properties, required };
}

const replyShape = z.object({
  bubbles: z.array(z.string().trim().min(1)).min(MIN_BUBBLES),
  // 상한을 넘겨도 버리지 않는다 — 말풍선과 같은 이유로, 근거 한 줄 때문에 턴을
  // 날리지 않는다. 넘친 것은 잘라서 기록한다.
  basis: z
    .array(z.object({ criterion_id: z.string().trim().min(1), claim: z.string().trim().min(1) }))
    .default([]),
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
    basis: parsed.basis.map((b) => ({ criterionId: b.criterion_id, claim: b.claim })),
    basisOverflow: parsed.basis.length > MAX_BASIS,
    ...(opts.first && parsed.title ? { title: parsed.title } : {}),
    crisis: parsed.crisis,
    // 마지막 턴은 되묻지 않는 턴이라 모델이 뭐라 하든 false 다. 그 뒤에 다음 턴이
    // 없으므로 읽힐 일도 없지만, 저장된 값이 화면과 어긋나 있으면 안 된다.
    asksUser: opts.last ? false : (parsed.asks_user ?? null),
  };
}
