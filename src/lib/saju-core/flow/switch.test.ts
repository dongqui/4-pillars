import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { flowYearAt } from "./year";
import { daeunSwitchIn } from "./switch";

const subject = analyze({
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  gender: "male",
  calendar: "solar",
});

describe("daeunSwitchIn", () => {
  it("전환이 없는 해에는 null 이다", () => {
    // 대운은 10년에 한 번이므로 연속한 10년 중 아홉 해는 전환이 없다.
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029];
    const hits = years.filter(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    );
    expect(hits).toHaveLength(1);
  });

  it("전환이 있는 해에는 그 구간 안의 시각을 준다", () => {
    const year = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029].find(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    )!;
    const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
    const found = daeunSwitchIn(subject, period)!;

    expect(found.at.getTime()).toBeGreaterThanOrEqual(period.start.getTime());
    expect(found.at.getTime()).toBeLessThan(period.end.getTime());
  });

  it("전후 대운은 이웃한 회차다", () => {
    const year = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029].find(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    )!;
    const found = daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(year, 5, 1))))!;

    expect(found.after.index).toBe(found.before.index + 1);
    expect(found.after.pillar).not.toBe(found.before.pillar);
  });

  it("첫 대운이 시작되기 한참 전(유년기)에는 null 이다", () => {
    expect(daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(1991, 5, 1))))).toBeNull();
  });
});
