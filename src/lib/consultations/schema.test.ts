import { describe, it, expect } from "vitest";
import {
  COUNSEL_TOOL_NAME,
  BUBBLE_MAX_CHARS,
  MAX_BASIS,
  MIN_BUBBLES,
  TITLE_MAX_CHARS,
  replyToolSchema,
  parseReply,
  fallbackTitle,
} from "./schema";

const middle = { first: false, last: false };

/** 테스트가 실제로 들여다보는 tool 파라미터 속성만. 나머지는 알 바 아니다. */
interface ReplyToolProperties {
  bubbles: { minItems: number; maxItems?: number };
  title?: unknown;
  crisis?: unknown;
}

function props(opts: { first: boolean; last: boolean }): ReplyToolProperties {
  return replyToolSchema(opts).properties as ReplyToolProperties;
}

describe("replyToolSchema", () => {
  // 상한을 박았더니 DeepSeek 가 지키지 않아 말풍선 4개짜리 답이 통째로 버려졌다.
  it("말풍선 하한만 박고 상한은 두지 않는다", () => {
    const p = props(middle);
    expect(p.bubbles.minItems).toBe(MIN_BUBBLES);
    expect(p.bubbles.maxItems).toBeUndefined();
  });

  // 추천 답변 칩은 없앴다(2026-09-16). 스키마에 남아 있으면 모델이 계속 채운다.
  it("추천 답변을 요구하지 않는다", () => {
    for (const opts of [middle, { first: true, last: false }, { first: false, last: true }]) {
      expect(replyToolSchema(opts).properties).not.toHaveProperty("user_replies");
      expect(replyToolSchema(opts).required).not.toContain("user_replies");
    }
  });

  it("말풍선 글자 상한이 새 분량 목표(두 말풍선에 1,000자)를 담는다", () => {
    expect(BUBBLE_MAX_CHARS * 2).toBeGreaterThanOrEqual(1000);
  });

  it("근거를 필수로 걸되 하한은 0 이다", () => {
    const p = replyToolSchema(middle).properties as Record<string, { minItems?: number; maxItems?: number }>;
    expect(p.basis.minItems).toBe(0);
    expect(p.basis.maxItems).toBe(MAX_BASIS);
    expect(replyToolSchema(middle).required).toContain("basis");
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
    basis: [{ criterion_id: "bigyeop-dominant", claim: "판단 기준을 자기 안에 두는 편이다" }],
    crisis: false,
    asks_user: true,
  };

  it("계약대로 온 응답을 통과시킨다", () => {
    expect(parseReply(good, middle)).toEqual({
      bubbles: good.bubbles,
      basis: [{ criterionId: "bigyeop-dominant", claim: "판단 기준을 자기 안에 두는 편이다" }],
      basisOverflow: false,
      crisis: false,
      asksUser: true,
    });
  });

  // ─── asks_user (대화 설계 §4) ───
  it("표시가 빠지면 null 이다 — false 로 접으면 짐작이 물러설 자리를 잃는다", () => {
    const noFlag = { bubbles: good.bubbles, crisis: false };
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

  it("말풍선이 많아도 버리지 않는다 — 개수 때문에 턴을 날리지 않는다", () => {
    const many = Array.from({ length: 5 }, (_, i) => `말 ${i}`);
    expect(parseReply({ ...good, bubbles: many }, middle).bubbles).toHaveLength(5);
  });

  // ─── basis (2026-09-25 실험) ───
  it("근거가 빠지면 빈 배열이다 — 근거 없이 답하는 턴도 정상이다", () => {
    const r = parseReply({ bubbles: good.bubbles, crisis: false }, middle);
    expect(r.basis).toEqual([]);
  });

  // 조용히 자르면 평가할 때 누락이 모델 쪽인지 우리 쪽인지 구분할 수 없다.
  it("근거가 상한을 넘어도 원본을 그대로 두고 넘쳤다고 표시한다", () => {
    const many = Array.from({ length: MAX_BASIS + 2 }, (_, i) => ({
      criterion_id: `c-${i}`,
      claim: "주장",
    }));
    const r = parseReply({ ...good, basis: many }, middle);
    expect(r.basis).toHaveLength(MAX_BASIS + 2);
    expect(r.basisOverflow).toBe(true);
  });

  it("상한 안이면 넘침 표시가 꺼져 있다", () => {
    expect(parseReply(good, middle).basisOverflow).toBe(false);
  });

  it("crisis 가 빠지면 false 로 본다 — 없다고 무료 턴을 주면 안 된다", () => {
    const noCrisis = { bubbles: good.bubbles };
    expect(parseReply(noCrisis, middle).crisis).toBe(false);
  });

  it("tool 이 아닌 값이 오면 거부한다", () => {
    expect(() => parseReply("그냥 텍스트", middle)).toThrow();
  });

  it("도구 이름은 emit_reply 다", () => {
    expect(COUNSEL_TOOL_NAME).toBe("emit_reply");
  });

  it("모델이 옛 버릇으로 user_replies 를 넘겨도 버린다", () => {
    const r = parseReply({ ...good, user_replies: ["그럼 지금 옮겨도 될까요?"] }, middle);
    expect(r).not.toHaveProperty("suggestions");
    expect(r).not.toHaveProperty("user_replies");
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
