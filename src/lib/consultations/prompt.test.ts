import { describe, it, expect } from "vitest";
import { COUNSELOR_SYSTEM_PROMPT, CRISIS_HOTLINE, buildTurnMessages } from "./prompt";
import type { MessageRow } from "./store";

const facts = "일간: 갑목 · 신강약: 중화";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["회사가 힘들어요"],
    suggestions: null,
    crisis: false,
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
});
