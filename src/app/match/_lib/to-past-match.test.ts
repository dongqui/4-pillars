import { describe, expect, it } from "vitest";
import type { MatchListRow } from "@/lib/matches/store";
import { toPastMatchView } from "./to-past-match";

const NOW = new Date(2026, 7, 23); // 2026-08-23 (로컬 기준)

function row(over: Partial<MatchListRow> = {}): MatchListRow {
  return {
    id: "7",
    subjectName: "곽희경",
    counterpartName: "백상현",
    relation: { type: "lover", subjectRole: null, counterpartRole: null },
    createdAt: "2026-08-18T04:12:00.000Z",
    ...over,
  };
}

describe("toPastMatchView", () => {
  it("두 이름을 쌍으로 잇고 이니셜을 뽑는다", () => {
    const v = toPastMatchView(row(), NOW);
    expect(v.pair).toBe("곽희경 × 백상현");
    expect(v.subjectInitial).toBe("곽");
    expect(v.counterpartInitial).toBe("백");
  });

  it("이름이 비어도 아바타를 비우지 않는다", () => {
    expect(toPastMatchView(row({ subjectName: "   " }), NOW).subjectInitial).toBe("?");
  });

  it("유형이 있으면 유형 라벨을 배지에 쓴다", () => {
    expect(toPastMatchView(row(), NOW).relationLabel).toBe("연인");
  });

  it("'기타'는 사용자가 적은 두 역할을 보여준다 — 목록에서 서로 구분돼야 한다", () => {
    const v = toPastMatchView(
      row({ relation: { type: "custom", subjectRole: "멘토", counterpartRole: "멘티" } }),
      NOW,
    );
    expect(v.relationLabel).toBe("멘토-멘티");
  });

  it("'기타'인데 역할이 비었으면 유형 라벨로 물러선다", () => {
    const v = toPastMatchView(
      row({ relation: { type: "custom", subjectRole: "", counterpartRole: "" } }),
      NOW,
    );
    expect(v.relationLabel).toBe("기타");
  });

  it("유형이 null 이면 배지를 그리지 않는다 — '안 고름'과 '기타'는 다른 사실이다", () => {
    const v = toPastMatchView(
      row({ relation: { type: null, subjectRole: null, counterpartRole: null } }),
      NOW,
    );
    expect(v.relationLabel).toBeNull();
  });

  it("같은 해면 '8월 18일'", () => {
    expect(toPastMatchView(row({ createdAt: "2026-08-18T04:12:00.000Z" }), NOW).dateLabel).toBe(
      "8월 18일",
    );
  });

  it("해가 다르면 연도까지 적는다 — '8월 18일' 만으로는 작년인지 알 수 없다", () => {
    expect(toPastMatchView(row({ createdAt: "2025-08-18T04:12:00.000Z" }), NOW).dateLabel).toBe(
      "2025.08.18",
    );
  });

  it("날짜를 못 읽으면 빈 문자열 — 'Invalid Date' 를 화면에 흘리지 않는다", () => {
    expect(toPastMatchView(row({ createdAt: "그런 날짜 없음" }), NOW).dateLabel).toBe("");
  });
});
