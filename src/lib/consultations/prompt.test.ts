import { describe, it, expect } from "vitest";
import {
  COUNSELOR_SYSTEM_PROMPT,
  CRISIS_HOTLINE,
  askedLastTurn,
  buildTurnMessages,
  endsWithQuestion,
} from "./prompt";
import { COUNSEL_TOOL_NAME } from "./schema";
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

  it("[해석 기준] 블록을 [사실] 과 같은 메시지에 싣는다 — 앞쪽이라야 캐시가 산다", () => {
    const m = buildTurnMessages({ ...base, criteria: "[해석 기준]\n### some-id" });
    expect(m[1].content).toContain("[사실]");
    expect(m[1].content).toContain("[해석 기준]");
    expect(m).toHaveLength(3);
  });

  it("기준이 없으면 블록을 붙이지 않는다", () => {
    expect(buildTurnMessages(base)[1].content).not.toContain("[해석 기준]");
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

  // 마지막이라고 이번 질문을 버리고 요약만 하면 마지막 턴이 답 없이 끝난다.
  it("마지막 턴에도 이번 질문에 먼저 답하라고 시킨다", () => {
    const m = buildTurnMessages({ ...base, isLast: true, remaining: 1 });
    const tail = m[m.length - 1].content;
    expect(tail).toContain("새 질문을 무시하고 이전 대화만 요약하지 마라");
    expect(tail).toContain("asks_user는 false");
    expect(tail).not.toContain("user_replies");
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
    expect(m[m.length - 1].content).toContain("직전 답변에서 사용자에게 확인을 요청했다");
    // 기본값이지 금지가 아니다 — 꼭 필요한 질문의 문은 열어 둔다.
    expect(m[m.length - 1].content).toContain("연속 질문이어도 가능하다");
    // 모호한 긍정("ㅇㅇㅇㅇ")을 한쪽 선택지로 접지 않게 한다.
    expect(m[m.length - 1].content).toContain("특정 선택지에 동의했다고 처리하지 마라");
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
    expect(m[m.length - 1].content).not.toContain("확인을 요청했다");
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
    expect(m[0].content).not.toContain("직전 답변에서");
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
  it("위기 상황 안내 번호를 담는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain(CRISIS_HOTLINE);
    expect(CRISIS_HOTLINE).toBe("109");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("119");
  });

  it("사실 블록을 계산된 명리 정보로 읽게 한다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실] 블록은 서버가 계산한 명리 정보다");
  });

  it("도구 이름을 상수에서 가져온다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain(`주어진 ${COUNSEL_TOOL_NAME} 도구`);
  });

  // ─── 2026-09-16 개편 ───
  it("질문에 대한 답을 먼저 두라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("첫 한두 문장 안에 질문에 대한 답을 둔다");
  });

  it("원국과 요즘 흐름을 나눠 읽게 한다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실 · 원국]");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실 · 요즘 흐름]");
  });

  it("근거 없는 회복 시점을 만들지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("날짜나 회복 약속을 만들지 않는다");
    // 한계 고지가 매 답의 정형화된 첫 문장이 되면 안 된다.
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("고정된 첫 문장으로 사용하지 않는다");
  });

  // ─── 2026-09-16 보정: 실측에서 나온 문제들 ───
  it("모호한 짧은 답을 한쪽으로 확정하지 않고 짧게 확인만 하라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("어느 쪽에 동의했는지 확정하지 않는다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("두 경우의 차이를 다시 장문으로 설명하지 않는다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("60~180자");
  });

  // "싫은 소리를 못 해요" 에 비견·겁재를 "관계가 깨질까 두려워한다" 의 근거로 붙였다.
  // 금지 문장을 쌓는 대신 [해석 기준] 블록으로 뜻을 먼저 고정하는 쪽으로 바꿨다.
  it("해석은 [해석 기준] 에서 출발하고 질문에 맞춰 뜻을 바꾸지 말라고 한다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[해석 기준]에서 출발한다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("질문에 맞춰 바꾸지 않는다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("같은 기준의 뜻을 뒤집지 않는다");
  });

  it("맞는 기준이 없으면 사주로 설명하지 말라고 한다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("맞는 기준이 없으면 사주로 설명하지 않는다");
  });

  it("기준 id 와 블록 이름을 말풍선에 쓰지 말라고 한다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("말풍선에 쓰지 않는다");
  });

  // 한 답에 비견·겁재·인성·상관·관성·신강·설기가 한꺼번에 나왔다.
  it("전문용어를 답 전체에서 두 개로 묶는다 — 새 용어만 세지 않는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("최대 두 개까지만");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("이전 턴에 나온 용어를 다시 사용하는 경우도");
  });

  // 개편이 뒤집은 옛 규칙이 같이 남으면 모델이 두 지시 사이에서 흔들린다.
  it("옛 규칙(용어 전면 금지 · 한 턴 한 역할 · 짧은 말풍선)을 남기지 않는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("사주 용어를 쓰지 마라");
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("지금 상대에게 필요한 것 하나를 골라라");
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("보통 한두 개면 된다");
  });

  // 추천 답변 칩은 없앴다. 프롬프트에 남아 있으면 스키마에 없는 필드를 채우려 든다.
  it("추천 답변을 언급하지 않는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("user_replies");
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("추천 답변");
  });

  it("습관적 되묻기를 기본으로 두지 않는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).not.toContain("답의 끝에서는 되묻는다");
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("매 턴 질문으로 끝낼 필요는 없다");
  });

  it("asks_user 를 무엇으로 판단할지 알려준다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("asks_user");
  });
});
