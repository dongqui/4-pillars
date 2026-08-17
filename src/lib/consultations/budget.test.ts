import { describe, it, expect } from "vitest";
import {
  DEFAULT_TURN_LIMIT,
  MAX_FREE_CRISIS_TURNS,
  decideTurn,
  nextState,
  countCrisis,
} from "./budget";

const open = { turnsUsed: 0, turnLimit: 10, status: "open" as const };

describe("decideTurn", () => {
  it("한 턴도 안 썼으면 열 번 남았고 마지막이 아니다", () => {
    expect(decideTurn(open)).toEqual({ kind: "allowed", remaining: 10, isLast: false });
  });

  it("한 번 남았으면 마지막 턴이다", () => {
    expect(decideTurn({ ...open, turnsUsed: 9 })).toEqual({
      kind: "allowed",
      remaining: 1,
      isLast: true,
    });
  });

  it("한도를 다 쓰면 막는다", () => {
    expect(decideTurn({ ...open, turnsUsed: 10 })).toEqual({ kind: "exhausted" });
  });

  it("한도를 넘긴 값이 저장돼 있어도 막는다", () => {
    expect(decideTurn({ ...open, turnsUsed: 11 })).toEqual({ kind: "exhausted" });
  });

  it("닫힌 상담은 턴이 남아 있어도 막는다", () => {
    expect(decideTurn({ ...open, status: "closed" })).toEqual({ kind: "exhausted" });
  });
});

describe("nextState", () => {
  it("보통 턴은 하나 올라가고 열린 채로 남는다", () => {
    expect(nextState(open, { crisis: false, crisisSoFar: 0 })).toEqual({
      turnsUsed: 1,
      turnLimit: 10,
      status: "open",
    });
  });

  it("마지막 턴을 쓰면 닫힌다", () => {
    expect(nextState({ ...open, turnsUsed: 9 }, { crisis: false, crisisSoFar: 0 })).toEqual({
      turnsUsed: 10,
      turnLimit: 10,
      status: "closed",
    });
  });

  it("위기 턴은 차감하지 않는다 — 위기에 남은 대화 0회를 만나면 안 된다", () => {
    expect(nextState({ ...open, turnsUsed: 4 }, { crisis: true, crisisSoFar: 0 })).toEqual({
      turnsUsed: 4,
      turnLimit: 10,
      status: "open",
    });
  });

  it("무료 위기 턴 한도를 채우면 그 다음부터는 차감한다", () => {
    expect(
      nextState({ ...open, turnsUsed: 4 }, { crisis: true, crisisSoFar: MAX_FREE_CRISIS_TURNS }),
    ).toEqual({ turnsUsed: 5, turnLimit: 10, status: "open" });
  });

  it("한도를 넘긴 위기 턴도 마지막 턴이면 상담을 닫는다", () => {
    expect(
      nextState({ ...open, turnsUsed: 9 }, { crisis: true, crisisSoFar: MAX_FREE_CRISIS_TURNS }),
    ).toEqual({ turnsUsed: 10, turnLimit: 10, status: "closed" });
  });
});

describe("countCrisis", () => {
  it("위기로 표시된 메시지 수를 센다", () => {
    expect(
      countCrisis([
        { crisis: false },
        { crisis: true },
        { crisis: true },
      ]),
    ).toBe(2);
  });

  it("빈 이력은 0 이다", () => {
    expect(countCrisis([])).toBe(0);
  });
});

describe("상수", () => {
  it("스펙이 정한 값이다", () => {
    expect(DEFAULT_TURN_LIMIT).toBe(10);
    expect(MAX_FREE_CRISIS_TURNS).toBe(3);
  });
});
