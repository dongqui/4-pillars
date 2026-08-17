import { describe, it, expect } from "vitest";
import {
  COUNSEL_TOOL_NAME,
  MAX_BUBBLES,
  MIN_BUBBLES,
  SUGGESTION_COUNT,
  TITLE_MAX_CHARS,
  replyToolSchema,
  parseReply,
  fallbackTitle,
} from "./schema";

const middle = { first: false, last: false };

function props(opts: { first: boolean; last: boolean }): Record<string, any> {
  return replyToolSchema(opts).properties as Record<string, any>;
}

describe("replyToolSchema", () => {
  it("말풍선 개수를 스키마에 박는다", () => {
    const p = props(middle);
    expect(p.bubbles.minItems).toBe(MIN_BUBBLES);
    expect(p.bubbles.maxItems).toBe(MAX_BUBBLES);
  });

  it("중간 턴은 추천질문을 정확히 두 개 요구한다", () => {
    const p = props(middle);
    expect(p.suggestions.minItems).toBe(SUGGESTION_COUNT);
    expect(p.suggestions.maxItems).toBe(SUGGESTION_COUNT);
  });

  it("마지막 턴은 추천질문을 요구하지 않는다 — 더 물어볼 수 없는데 물으라고 하면 안 된다", () => {
    const p = props({ first: false, last: true });
    expect(p.suggestions.maxItems).toBe(0);
  });

  it("첫 턴에만 제목을 요구한다", () => {
    expect(props({ first: true, last: false }).title).toBeDefined();
    expect(props(middle).title).toBeUndefined();
  });

  it("첫 턴은 title 을 필수로 건다", () => {
    expect(replyToolSchema({ first: true, last: false }).required).toContain("title");
  });

  it("crisis 는 어느 턴에나 있다", () => {
    expect(props(middle).crisis).toBeDefined();
    expect(props({ first: true, last: true }).crisis).toBeDefined();
  });
});

describe("parseReply", () => {
  const good = {
    bubbles: ["첫 마디예요", "두 번째 마디예요"],
    suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
    crisis: false,
  };

  it("계약대로 온 응답을 통과시킨다", () => {
    expect(parseReply(good, middle)).toEqual(good);
  });

  it("첫 턴에는 제목을 함께 읽는다", () => {
    const r = parseReply({ ...good, title: "직장에서의 답답함" }, { first: true, last: false });
    expect(r.title).toBe("직장에서의 답답함");
  });

  it("말풍선이 하나뿐이면 거부한다", () => {
    expect(() => parseReply({ ...good, bubbles: ["하나"] }, middle)).toThrow();
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
    const { crisis, ...noCrisis } = good;
    expect(parseReply(noCrisis, middle).crisis).toBe(false);
  });

  it("tool 이 아닌 값이 오면 거부한다", () => {
    expect(() => parseReply("그냥 텍스트", middle)).toThrow();
  });

  it("도구 이름은 emit_reply 다", () => {
    expect(COUNSEL_TOOL_NAME).toBe("emit_reply");
  });

  it("추천질문이 하나만 와도 통과시킨다 — 칩 하나 때문에 턴을 버리지 않는다", () => {
    const r = parseReply({ ...good, suggestions: ["하나만"] }, middle);
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
