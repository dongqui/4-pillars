import { describe, expect, it } from "vitest";
import { emptyDraft, toCounterpart, type Draft } from "./to-counterpart";
import {
  NEW_COUNTERPART_ID,
  counterpartAfterSubjectChange,
  newCounterpartOption,
} from "./counterpart-value";

const filledDraft: Draft = {
  ...emptyDraft,
  name: "새사람",
  y: "1990",
  m: "4",
  d: "5",
  h: "9",
  min: "30",
};

/** toCounterpart 는 덜 찬 draft 에 null 을 준다 — 테스트는 다 찬 것만 쓴다. */
function inputOf(draft: Draft) {
  const input = toCounterpart(draft);
  if (!input) throw new Error("테스트 draft 가 덜 찼다");
  return input;
}

describe("newCounterpartOption", () => {
  it("저장된 사람과 같은 모양의 줄이 된다 — 목록에 그대로 끼워 넣는다", () => {
    expect(newCounterpartOption(inputOf(filledDraft), true)).toEqual({
      id: NEW_COUNTERPART_ID,
      name: "새사람",
      initial: "새",
      birthLabel: "1990.04.05 · 09:30",
      saved: true,
    });
  });

  it("id 가 숫자가 아니라 저장된 프로필 id 와 겹치지 않는다", () => {
    expect(Number.isNaN(Number(NEW_COUNTERPART_ID))).toBe(true);
  });

  it("시간을 모르면 시각 자리에 '시간 모름' 이 선다", () => {
    const draft = { ...filledDraft, timeKnown: false };
    expect(newCounterpartOption(inputOf(draft), true).birthLabel).toBe("1990.04.05 · 시간 모름");
  });

  it("저장하지 않기로 하면 saved=false — 목록이 '· 저장 안 함' 을 붙인다", () => {
    expect(newCounterpartOption(inputOf(filledDraft), false).saved).toBe(false);
  });
});

describe("counterpartAfterSubjectChange", () => {
  it("상대로 골라 둔 사람을 '나' 로 바꾸면 상대를 떨군다", () => {
    const counterpart = { kind: "saved", profileId: "2", name: "백상현" } as const;
    expect(counterpartAfterSubjectChange(counterpart, "2")).toBeNull();
  });

  it("다른 사람을 '나' 로 바꾸면 상대는 그대로다", () => {
    const counterpart = { kind: "saved", profileId: "2", name: "백상현" } as const;
    expect(counterpartAfterSubjectChange(counterpart, "1")).toBe(counterpart);
  });

  it("즉석 입력은 프로필 id 가 없어 '나' 와 겹칠 수 없다", () => {
    const counterpart = {
      kind: "new",
      input: { name: "새사람" } as never,
      name: "새사람",
      save: true,
    } as const;
    expect(counterpartAfterSubjectChange(counterpart, "2")).toBe(counterpart);
  });

  it("고른 상대가 없으면 그대로 없다", () => {
    expect(counterpartAfterSubjectChange(null, "2")).toBeNull();
  });
});
