import { describe, it, expect } from "vitest";
import {
  COUNSELOR_SYSTEM_PROMPT,
  CRISIS_HOTLINE,
  askedLastTurn,
  buildTurnMessages,
  endsWithQuestion,
} from "./prompt";
import type { MessageRow } from "./store";

const facts = "일간: 갑목 · 신강약: 중화";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["회사가 힘들어요"],
    suggestions: null,
    crisis: false,
    asksUser: null,
    turnNo: 1,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...over,
  };
}

const base = { facts, history: [], utterance: "요즘 잠이 안 와요", remaining: 8, isLast: false };

describe("buildTurnMessages", () => {
  it("시스템 → 사실 블록 → 이번 발화 순으로 세운다", () => {
    const m = buildTurnMessages(base);
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
    expect(m[1].content).toContain(facts);
    expect(m[m.length - 1].content).toContain("요즘 잠이 안 와요");
  });

  it("이력의 상담사 말풍선을 assistant 한 덩어리로 잇는다", () => {
    const m = buildTurnMessages({
      ...base,
      history: [
        msg({ role: "user", bubbles: ["첫 고민이에요"] }),
        msg({ id: "2", role: "counselor", bubbles: ["첫 마디", "둘째 마디"] }),
      ],
    });
    const assistant = m.filter((x) => x.role === "assistant");
    expect(assistant).toHaveLength(1);
    expect(assistant[0].content).toBe("첫 마디\n둘째 마디");
  });

  it("남은 턴을 마지막 메시지 꼬리에 붙인다", () => {
    const m = buildTurnMessages({ ...base, remaining: 3 });
    expect(m[m.length - 1].content).toContain("남은 턴: 3");
  });

  // ─── 비용을 지키는 테스트 ───
  it("남은 턴이 달라도 앞쪽 메시지는 글자 하나 안 바뀐다 (prefix 캐시)", () => {
    const a = buildTurnMessages({ ...base, remaining: 9 });
    const b = buildTurnMessages({ ...base, remaining: 2 });
    expect(a.slice(0, -1)).toEqual(b.slice(0, -1));
  });

  it("마지막 턴 지시문도 앞쪽 메시지를 바꾸지 않는다", () => {
    const a = buildTurnMessages({ ...base, isLast: false });
    const b = buildTurnMessages({ ...base, isLast: true });
    expect(a.slice(0, -1)).toEqual(b.slice(0, -1));
  });

  it("시스템 프롬프트에 남은 턴 숫자가 새지 않는다", () => {
    const m = buildTurnMessages({ ...base, remaining: 7 });
    expect(m[0].content).not.toContain("남은 턴");
  });

  it("마지막 턴이면 마무리하라고 시킨다", () => {
    const m = buildTurnMessages({ ...base, isLast: true, remaining: 1 });
    expect(m[m.length - 1].content).toContain("마지막");
  });

  it("마지막 턴이 아니면 마무리 지시문이 없다", () => {
    const m = buildTurnMessages({ ...base, isLast: false });
    expect(m[m.length - 1].content).not.toContain("마지막");
  });

  // ─── 되묻기 억제 (대화 설계 §4) ───
  it("직전 답이 되묻기로 끝났으면 이번엔 되묻지 말라고 시킨다", () => {
    const m = buildTurnMessages({
      ...base,
      history: [
        msg({
          id: "2",
          role: "counselor",
          bubbles: ["그렇군요", "어느 쪽이 더 가까워요?"],
        }),
      ],
    });
    expect(m[m.length - 1].content).toContain("되묻지 말고");
    // 기본값이지 금지가 아니다 — 꼭 필요한 질문의 문은 열어 둔다.
    expect(m[m.length - 1].content).toContain("물어도 된다");
  });

  it("직전 답이 되묻기가 아니었으면 억제하지 않는다", () => {
    const m = buildTurnMessages({
      ...base,
      history: [
        msg({
          id: "2",
          role: "counselor",
          bubbles: ["하나만 정해서 지켜보는 식으로요."],
        }),
      ],
    });
    expect(m[m.length - 1].content).not.toContain("되묻지 말고");
  });

  // 억제는 턴마다 켜졌다 꺼졌다 하는 값이다. 시스템 프롬프트에 새면 매 턴 캐시가 깨진다.
  it("억제 지시는 시스템 프롬프트가 아니라 꼬리에 붙는다", () => {
    const m = buildTurnMessages({
      ...base,
      history: [
        msg({
          id: "2",
          role: "counselor",
          bubbles: ["어느 쪽이 더 가까워요?"],
        }),
      ],
    });
    expect(m[0].content).not.toContain("직전 답변이");
  });
});

describe("endsWithQuestion", () => {
  it("마지막 말풍선이 물음표로 끝나면 참이다", () => {
    expect(endsWithQuestion(["어느 쪽이에요?"])).toBe(true);
  });

  it("물음표가 없으면 거짓이다", () => {
    expect(endsWithQuestion(["그렇게 해보세요."])).toBe(false);
  });

  // 마지막 말풍선만 본다. 앞이 질문이어도 마지막이 제안으로 맺었으면 되묻은 게 아니다.
  it("마지막 말풍선만 본다", () => {
    expect(endsWithQuestion(["어느 쪽이에요?", "천천히 생각해도 돼요."])).toBe(
      false,
    );
  });

  it("전각 물음표도 센다", () => {
    expect(endsWithQuestion(["어느 쪽이에요？"])).toBe(true);
  });

  it("말풍선이 없으면 거짓이다", () => {
    expect(endsWithQuestion([])).toBe(false);
  });
});

describe("askedLastTurn", () => {
  const counselor = (over: Partial<MessageRow>) =>
    msg({ id: "2", role: "counselor", ...over });

  it("모델이 남긴 표시를 그대로 믿는다", () => {
    expect(
      askedLastTurn([counselor({ bubbles: ["아무 말"], asksUser: true })]),
    ).toBe(true);
    expect(
      askedLastTurn([counselor({ bubbles: ["아무 말"], asksUser: false })]),
    ).toBe(false);
  });

  // 물음표 짐작이 틀리는 두 자리다. 표시가 있으면 짐작은 아예 돌지 않아야 한다.
  it("물음표가 없어도 표시가 true 면 되물은 것이다", () => {
    const m = counselor({
      bubbles: ["어느 쪽이 더 가까운지 말해줘요."],
      asksUser: true,
    });
    expect(askedLastTurn([m])).toBe(true);
  });

  it("물음표가 있어도 표시가 false 면 되물은 게 아니다", () => {
    const m = counselor({
      bubbles: ["'내가 왜 이러지?' 하는 생각이 들 수 있어요."],
      asksUser: false,
    });
    expect(askedLastTurn([m])).toBe(false);
  });

  // 0044 마이그레이션 이전에 쌓인 행. 표시가 없는 그 자리에서만 짐작이 답한다.
  it("표시가 없는 옛 행에서만 물음표로 물러선다", () => {
    expect(
      askedLastTurn([
        counselor({ bubbles: ["어느 쪽이에요?"], asksUser: null }),
      ]),
    ).toBe(true);
    expect(
      askedLastTurn([
        counselor({ bubbles: ["그렇게 해보세요."], asksUser: null }),
      ]),
    ).toBe(false);
  });

  it("마지막 상담사 답만 본다 — 그 뒤의 사용자 발화는 세지 않는다", () => {
    const history = [
      counselor({ id: "1", bubbles: ["그렇게 해보세요."], asksUser: false }),
      msg({ id: "2", role: "user", bubbles: ["그럼 지금 옮겨도 될까요?"] }),
    ];
    expect(askedLastTurn(history)).toBe(false);
  });

  it("이력이 비면 거짓이다 — 첫 턴은 억제할 직전 답이 없다", () => {
    expect(askedLastTurn([])).toBe(false);
  });
});

describe("COUNSELOR_SYSTEM_PROMPT", () => {
  it("사주 용어를 쓰지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("용어");
  });

  it("위기 상황 안내 번호를 담는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain(CRISIS_HOTLINE);
    expect(CRISIS_HOTLINE).toBe("109");
  });

  it("사실 블록 밖 정보를 지어내지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실]");
  });

  // 문체 규칙(해요체 · 되묻기)이 추천 답변까지 덮으면 상담사가 되묻는 질문이
  // 칩으로 나오고, 그걸 누른 사용자가 상담사에게 그 질문을 하는 꼴이 된다.
  it("추천 답변이 사용자의 말이라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("user_replies");
  });

  // ─── 설계 가이드가 못박은 것들 ───
  it("핵심 해석에 사실 근거를 하나 이상 쓰라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("하나 이상");
  });

  it("원국과 요즘 흐름을 섞지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실 · 원국]");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실 · 요즘 흐름]");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("섞지 마라");
  });

  it("사주를 현재 상태의 원인으로 단정하지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("원인");
  });

  // 예전 프롬프트는 "답의 끝에서는 되묻는다" 였다. 그 한 줄이 모든 턴을 질문으로
  // 끝나게 만들어 상담을 문진표로 바꿨다(대화 설계 §4).
  it("습관적으로 되묻지 말라고 뒤집어 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("답의 끝에서는 되묻는다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain(
      "습관적으로 답 끝에 질문을 붙이지 마라",
    );
  });

  it("추천 답변을 갈래가 없으면 비우라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("빈 배열로 둔다");
  });

  // 사실이 주어졌다는 이유만으로 흐름을 매번 언급하면, 시점과 무관한 고민
  // ("사람한테 싫은 소리를 못 하겠다")에도 "요즘 흐름을 보면…" 이 붙는다.
  it("사실을 체크리스트처럼 소비하지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("체크리스트가 아니다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("주어져 있다는 이유만으로");
  });

  // 연속 질문 억제는 기본값이지 금지가 아니다 — 새로 나온 정보를 확인해야 하는
  // 자리까지 막으면 문진표를 피하려다 해석이 틀어진다.
  it("되묻기 억제가 금지가 아니라 기본값이라고 적는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("금지는 아니다");
  });

  it("asks_user 를 무엇으로 판단할지 알려준다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("asks_user");
  });
});
