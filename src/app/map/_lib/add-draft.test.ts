import { describe, it, expect } from "vitest";
import { addDraftIssues, emptyAddDraft, toAddBody, type AddDraft } from "./add-draft";

const filled: AddDraft = {
  name: "민수", calendar: "solar", isLeapMonth: false, y: "1991", m: "3", d: "2",
};

describe("addDraftIssues", () => {
  it("다 채우면 문제가 없다", () => {
    expect(addDraftIssues(filled, 2026)).toEqual([]);
  });

  it("이름이 비면 name", () => {
    expect(addDraftIssues({ ...filled, name: "  " }, 2026)).toContain("name");
  });

  it("연도가 네 자리가 아니면 birth", () => {
    expect(addDraftIssues({ ...filled, y: "91" }, 2026)).toContain("birth");
  });

  it("없는 날짜면 birth", () => {
    expect(addDraftIssues({ ...filled, m: "2", d: "31" }, 2026)).toContain("birth");
  });

  it("미래 연도면 birth", () => {
    expect(addDraftIssues({ ...filled, y: "2027" }, 2026)).toContain("birth");
  });
});

describe("toAddBody", () => {
  it("완성된 초안을 API 본문으로 바꾼다", () => {
    expect(toAddBody(filled, 2026)).toEqual({
      name: "민수",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1991, month: 3, day: 2 },
    });
  });

  it("이름 앞뒤 공백을 자른다", () => {
    expect(toAddBody({ ...filled, name: " 민수 " }, 2026)!.name).toBe("민수");
  });

  it("덜 찼으면 null", () => {
    expect(toAddBody({ ...filled, d: "" }, 2026)).toBeNull();
  });

  it("양력이면 윤달을 끈다", () => {
    expect(toAddBody({ ...filled, isLeapMonth: true }, 2026)!.isLeapMonth).toBe(false);
  });
});

describe("emptyAddDraft", () => {
  it("빈 초안은 아무 안내도 띄우지 않을 수 있게 전부 비어 있다", () => {
    expect(emptyAddDraft.name).toBe("");
    expect(emptyAddDraft.y).toBe("");
  });
});
