import { describe, expect, it } from "vitest";
import { emptyDraft, type Draft } from "./to-counterpart";
import type { PersonOption } from "./to-person-option";
import { counterpartAfterSubjectChange, resyncCounterpart } from "./resync-counterpart";

const person = (id: string, name: string): PersonOption => ({
  id,
  name,
  initial: name[0],
  birthLabel: "1990.04.05",
  kind: "self",
});

const A = person("1", "김동진");
const B = person("2", "백상현");

const filledDraft: Draft = { ...emptyDraft, name: "새사람", y: "1990", m: "4", d: "5", h: "9", min: "30" };

describe("resyncCounterpart", () => {
  it("'저장된 사람' 에서는 목록에 있는 사람만 선택값으로 남는다", () => {
    expect(
      resyncCounterpart({
        segment: "saved",
        draft: emptyDraft,
        selectedSavedId: "2",
        candidates: [A, B],
      }),
    ).toEqual({ kind: "saved", profileId: "2", name: "백상현" });
  });

  it("고른 사람이 목록에서 빠졌으면 null — 아무 카드도 강조되지 않은 채 제출이 열려 있으면 안 된다", () => {
    expect(
      resyncCounterpart({
        segment: "saved",
        draft: filledDraft,
        selectedSavedId: "2",
        candidates: [A],
      }),
    ).toBeNull();
  });

  it("'새로 입력' 에서는 draft 를 다시 읽는다 — 저장된 선택값이 남아 있어도 그것을 쓰지 않는다", () => {
    const value = resyncCounterpart({
      segment: "new",
      draft: filledDraft,
      selectedSavedId: "2",
      candidates: [A, B],
    });
    expect(value).toEqual({ kind: "new", input: expect.objectContaining({ name: "새사람" }), name: "새사람" });
  });

  it("'새로 입력' 이 아직 덜 채워졌으면 null — 제출을 막는 값이다", () => {
    expect(
      resyncCounterpart({
        segment: "new",
        draft: emptyDraft,
        selectedSavedId: null,
        candidates: [A, B],
      }),
    ).toBeNull();
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
    } as const;
    expect(counterpartAfterSubjectChange(counterpart, "2")).toBe(counterpart);
  });

  it("고른 상대가 없으면 그대로 없다", () => {
    expect(counterpartAfterSubjectChange(null, "2")).toBeNull();
  });
});
