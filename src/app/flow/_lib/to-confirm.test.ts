import { describe, expect, it } from "vitest";
import { buildYearOptions, formatPeriod, formatRangeLabel } from "./to-confirm";

const NOW_YEAR = 2026;

function opts(over: Partial<Parameters<typeof buildYearOptions>[0]> = {}) {
  return buildYearOptions({
    currentYear: NOW_YEAR,
    span: 5,
    birthYear: 1993,
    rangeOf: (y) => `${y}.2.4 – ${y + 1}.2.4`,
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

  it("입춘 구간 라벨을 붙인다 — rangeOf 가 그대로 실린다", () => {
    const o = opts().find((y) => y.year === 2026)!;
    expect(o.range).toBe("2026.2.4 – 2027.2.4");
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

  it("창 밖으로 밀려난 구매 해도 칸으로 남는다 — 유일한 재진입 경로다", () => {
    // 2026년에 2021년(그때는 currentYear-5, 팔 수 있는 가장 이른 해)을 샀다.
    // 입춘이 두 번 지나 currentYear 가 2028 이 되면 창은 2023~2033 이라
    // 2021년은 더 이상 ±span 안에 없다 — 그래도 카드는 남아야 한다.
    const owned = new Map([[2021, { flowId: "own-2021", entitled: true }]]);
    const years = opts({ currentYear: 2028, owned });
    const strand = years.find((y) => y.year === 2021);

    expect(strand?.owned).toBe(true);
    expect(strand?.flowId).toBe("own-2021");
    // 창 안(2023~2033)의 칸 수는 그대로고, 창 밖 구매 해가 하나 더 얹힌다.
    expect(years.map((y) => y.year)).toEqual([
      2021, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033,
    ]);
  });

  it("행은 있지만 권한이 없는 창 밖 해는 칸으로 안 만든다 — 구매를 유도하지 않는다", () => {
    // entitled: false 인 창 밖 행(예: 생성이 한도에서 막힌 자리)까지 얹으면
    // 존재하지 않는 구매를 광고하는 칸이 생긴다.
    const owned = new Map([[2019, { flowId: "row-only", entitled: false }]]);
    const years = opts({ currentYear: 2028, owned });
    expect(years.some((y) => y.year === 2019)).toBe(false);
  });
});

describe("formatRangeLabel", () => {
  it("KST 날짜를 압축형으로 낸다", () => {
    // 2026 입춘(KST 2026-02-04 05:02) ~ 2027 입춘(KST 2027-02-04 10:46) 근사값.
    // UTC 로는 전날 저녁이라, KST 변환 없이는 2.3 으로 하루 밀린다.
    const start = new Date("2026-02-03T20:02:00Z");
    const end = new Date("2027-02-04T01:46:00Z");
    expect(formatRangeLabel(start, end)).toBe("2026.2.4 – 2027.2.4");
  });
});

describe("formatPeriod", () => {
  it("연도를 감추지 않는다", () => {
    const s = formatPeriod(new Date("2027-02-04T09:00:00Z"), new Date("2028-02-04T15:00:00Z"));
    expect(s).toBe("2027년 2월 초부터 2028년 2월 초까지");
  });
});
