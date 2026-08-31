import { describe, it, expect } from "vitest";
import {
  COUNSEL_TOOL_NAME,
  MAX_BUBBLES,
  MIN_BUBBLES,
  MAX_SUGGESTIONS,
  TITLE_MAX_CHARS,
  replyToolSchema,
  parseReply,
  fallbackTitle,
} from "./schema";

const middle = { first: false, last: false };

/** 테스트가 실제로 들여다보는 tool 파라미터 속성만. 나머지는 알 바 아니다. */
interface ReplyToolProperties {
  bubbles: { minItems: number; maxItems: number };
  user_replies: { minItems: number; maxItems: number };
  title?: unknown;
  crisis?: unknown;
}

function props(opts: { first: boolean; last: boolean }): ReplyToolProperties {
  return replyToolSchema(opts).properties as ReplyToolProperties;
}

describe("replyToolSchema", () => {
  it("말풍선 개수를 스키마에 박는다", () => {
    const p = props(middle);
    expect(p.bubbles.minItems).toBe(MIN_BUBBLES);
    expect(p.bubbles.maxItems).toBe(MAX_BUBBLES);
  });

  // 예전에는 minItems 도 2 였다. 그러면 낼 갈래가 없는 턴에도 모델이 두 개를
  // 지어내야 해서, 대부분이 방금 한 제안에 서명하게 만드는 문장이 됐다(대화 설계 §18).
  it("추천 답변에 하한을 걸지 않는다 — 갈래가 없으면 안 내는 것이 맞다", () => {
    const p = props(middle);
    expect(p.user_replies.minItems).toBe(0);
    expect(p.user_replies.maxItems).toBe(MAX_SUGGESTIONS);
  });

  it("마지막 턴은 추천질문을 요구하지 않는다 — 더 물어볼 수 없는데 물으라고 하면 안 된다", () => {
    const p = props({ first: false, last: true });
    expect(p.user_replies.maxItems).toBe(0);
  });

  it("첫 턴에만 제목을 요구한다", () => {
    expect(props({ first: true, last: false }).title).toBeDefined();
    expect(props(middle).title).toBeUndefined();
  });

  it("첫 턴은 title 을 필수로 건다", () => {
    expect(replyToolSchema({ first: true, last: false }).required).toContain("title");
  });

  it("asks_user 를 필수로 건다 — 다음 턴의 되묻기 억제가 이 값을 읽는다", () => {
    expect(replyToolSchema(middle).required).toContain("asks_user");
  });

  // 프롬프트로 "마지막엔 묻지 마세요" 라고 부탁하는 대신 값 자체를 스키마로 좁힌다.
  it("마지막 턴은 asks_user 를 false 로 못 박는다", () => {
    const p = replyToolSchema({ first: false, last: true })
      .properties as Record<string, { enum?: unknown[] }>;
    expect(p.asks_user.enum).toEqual([false]);
    expect(
      (
        replyToolSchema(middle).properties as Record<
          string,
          { enum?: unknown[] }
        >
      ).asks_user.enum,
    ).toBeUndefined();
  });

  it("crisis 는 어느 턴에나 있다", () => {
    expect(props(middle).crisis).toBeDefined();
    expect(props({ first: true, last: true }).crisis).toBeDefined();
  });
});

describe("parseReply", () => {
  const good = {
    bubbles: ["첫 마디예요", "두 번째 마디예요"],
    user_replies: ["그럼 지금 옮겨도 될까요?", "아직 준비가 안 된 것 같아요"],
    crisis: false,
    asks_user: true,
  };

  it("계약대로 온 응답을 통과시킨다", () => {
    expect(parseReply(good, middle)).toEqual({
      bubbles: good.bubbles,
      // 모델이 채우는 이름(user_replies)과 저장·API 이름(suggestions)이 다르다.
      // 그 되돌림이 여기서 깨지면 화면에 칩이 아예 뜨지 않는다.
      suggestions: good.user_replies,
      crisis: false,
      asksUser: true,
    });
  });

  // ─── asks_user (대화 설계 §4) ───
  it("표시가 빠지면 null 이다 — false 로 접으면 짐작이 물러설 자리를 잃는다", () => {
    const noFlag = { bubbles: good.bubbles, user_replies: good.user_replies, crisis: false };
    expect(parseReply(noFlag, middle).asksUser).toBeNull();
  });

  it("마지막 턴은 모델이 뭐라 하든 false 다", () => {
    expect(parseReply(good, { first: false, last: true }).asksUser).toBe(false);
  });

  it("첫 턴에는 제목을 함께 읽는다", () => {
    const r = parseReply({ ...good, title: "직장에서의 답답함" }, { first: true, last: false });
    expect(r.title).toBe("직장에서의 답답함");
  });

  // 공감과 해석을 한 말풍선에 묶으면 한 개로 끝나는 턴이 생긴다(대화 설계 §20.1).
  // 예전 하한 2 는 그런 답을 통째로 버렸다.
  it("말풍선 하나짜리 답도 통과시킨다", () => {
    expect(
      parseReply({ ...good, bubbles: ["한 호흡으로 끝나는 답이에요"] }, middle)
        .bubbles,
    ).toHaveLength(1);
  });

  it("말풍선이 비면 거부한다", () => {
    expect(() => parseReply({ ...good, bubbles: [] }, middle)).toThrow();
  });

  it("말풍선이 상한을 넘으면 거부한다", () => {
    const many = Array.from({ length: MAX_BUBBLES + 1 }, (_, i) => `말 ${i}`);
    expect(() => parseReply({ ...good, bubbles: many }, middle)).toThrow();
  });

  it("마지막 턴에 추천질문이 오면 버리고 빈 배열로 만든다", () => {
    const r = parseReply(good, { first: false, last: true });
    expect(r.suggestions).toEqual([]);
  });

  it("crisis 가 빠지면 false 로 본다 — 없다고 무료 턴을 주면 안 된다", () => {
    const noCrisis = { bubbles: good.bubbles, user_replies: good.user_replies };
    expect(parseReply(noCrisis, middle).crisis).toBe(false);
  });

  it("tool 이 아닌 값이 오면 거부한다", () => {
    expect(() => parseReply("그냥 텍스트", middle)).toThrow();
  });

  it("도구 이름은 emit_reply 다", () => {
    expect(COUNSEL_TOOL_NAME).toBe("emit_reply");
  });

  it("추천질문이 하나만 와도 통과시킨다 — 칩 하나 때문에 턴을 버리지 않는다", () => {
    const r = parseReply({ ...good, user_replies: ["하나만"] }, middle);
    expect(r.suggestions).toEqual(["하나만"]);
  });

  it("첫 턴에 제목이 없어도 통과시킨다 — 메우는 것은 turn.ts 의 몫이다", () => {
    const r = parseReply(good, { first: true, last: false });
    expect(r.title).toBeUndefined();
  });
});

describe("fallbackTitle", () => {
  it("짧은 발화는 그대로 쓴다", () => {
    expect(fallbackTitle("잠이 안 와요")).toBe("잠이 안 와요");
  });

  it("앞뒤 공백을 지운다", () => {
    expect(fallbackTitle("  힘들어요  ")).toBe("힘들어요");
  });

  it("상한을 넘기면 잘라내고 줄임표를 붙인다", () => {
    const long = "가".repeat(TITLE_MAX_CHARS + 10);
    const title = fallbackTitle(long);
    expect([...title]).toHaveLength(TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);
  });

  it("상한 딱 맞는 길이는 줄임표 없이 그대로 쓴다", () => {
    const exact = "가".repeat(TITLE_MAX_CHARS);
    expect(fallbackTitle(exact)).toBe(exact);
  });

  it("서로게이트 쌍을 반으로 자르지 않는다", () => {
    const emoji = "🙂".repeat(TITLE_MAX_CHARS + 5);
    const title = fallbackTitle(emoji);
    expect([...title]).toHaveLength(TITLE_MAX_CHARS);
    expect(title).not.toContain("�");
  });
});
