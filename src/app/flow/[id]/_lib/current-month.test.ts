import { describe, expect, it } from "vitest";
import { currentMonthIndex, monthLabel, monthRange } from "./current-month";

const months = Array.from({ length: 12 }, (_, i) => ({
  index: i + 1,
  start: new Date(Date.UTC(2027, 1 + i, 4)).toISOString(),
  end: new Date(Date.UTC(2027, 2 + i, 4)).toISOString(),
  korean: "임인",
  pivot: false,
}));

describe("currentMonthIndex", () => {
  it("지금이 속한 달을 고른다", () => {
    expect(currentMonthIndex(months, new Date("2027-04-20T00:00:00Z"))).toBe(3);
  });

  it("기간 밖이면 null 이다 — 아무 칸도 강조하지 않는다", () => {
    // 지난 해·다가올 해를 열면 강조할 '지금' 이 없다. 마지막 칸으로 물러서면
    // 2021년 리포트에서 12월이 '현재' 로 표시된다.
    expect(currentMonthIndex(months, new Date("2021-06-01T00:00:00Z"))).toBeNull();
    expect(currentMonthIndex(months, new Date("2030-06-01T00:00:00Z"))).toBeNull();
  });

  it("경계에서 앞 칸이 끝나고 뒤 칸이 시작한다", () => {
    const at = new Date(months[1].start);
    expect(currentMonthIndex(months, at)).toBe(2);
  });
});

describe("monthLabel / monthRange", () => {
  it("KST 달력 월로 이름을 붙인다", () => {
    expect(monthLabel(months[1])).toBe("3월");
  });

  it("절기 기준 기간을 보조로 보여준다", () => {
    // 명리 월운은 달력 1일~말일과 일치하지 않는다 — 같다고 오해하면 안 된다
    expect(monthRange(months[1])).toBe("3월 초 ~ 4월 초");
  });
});
