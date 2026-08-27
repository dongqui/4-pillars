import { describe, expect, it } from "vitest";
import { buildYearOptions, formatPeriod } from "./to-confirm";

const NOW_YEAR = 2026;

function opts(over: Partial<Parameters<typeof buildYearOptions>[0]> = {}) {
  return buildYearOptions({
    currentYear: NOW_YEAR,
    span: 5,
    birthYear: 1993,
    owned: new Map(),
    ...over,
  });
}

describe("buildYearOptions", () => {
  it("현재 ±5년, 11칸을 낸다", () => {
    const years = opts().map((o) => o.year);
    expect(years).toEqual([2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031]);
  });

  it("태어나기 전 해는 빼고 낸다", () => {
    // 만 나이가 음수가 되고, 그 해의 대운이 없다
    const years = opts({ birthYear: 2024 }).map((o) => o.year);
    expect(years).toEqual([2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031]);
  });

  it("만 나이를 붙인다", () => {
    expect(opts().find((o) => o.year === 2026)?.age).toBe(33);
  });

  it("지난·올해·다가올을 표시한다", () => {
    const byYear = new Map(opts().map((o) => [o.year, o.tag]));
    expect(byYear.get(2025)).toBe("지난");
    expect(byYear.get(2026)).toBe("올해");
    expect(byYear.get(2027)).toBe("다가올");
  });

  it("권한이 있는 해만 owned 다 — 행 존재가 아니다", () => {
    // 행은 공짜로 만들어지고 차감은 생성 자리에서 일어난다. 생성이 한도나
    // 잔액에서 막히면 행만 남고 권한은 없다.
    const owned = new Map([
      [2025, { flowId: "7", entitled: true }],
      [2026, { flowId: "8", entitled: false }],
    ]);
    const byYear = new Map(opts({ owned }).map((o) => [o.year, o]));
    expect(byYear.get(2025)?.owned).toBe(true);
    expect(byYear.get(2026)?.owned).toBe(false);
    // 행이 있으면 flowId 는 준다 — 재구매 시 같은 행으로 수렴한다
    expect(byYear.get(2026)?.flowId).toBe("8");
    expect(byYear.get(2027)?.flowId).toBeNull();
  });
});

describe("formatPeriod", () => {
  it("연도를 감추지 않는다", () => {
    const s = formatPeriod(new Date("2027-02-04T09:00:00Z"), new Date("2028-02-04T15:00:00Z"));
    expect(s).toBe("2027년 2월 초부터 2028년 2월 초까지");
  });
});
