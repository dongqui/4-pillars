import { describe, it, expect } from "vitest";
import { analyze, buildChart, type BirthInput } from "@/lib/saju-core";
import { chartKey, luckKey, pillarsJson } from "./key";

const base: BirthInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 0,
  calendar: "solar",
  gender: "male",
};

describe("chartKey", () => {
  it("같은 입력이면 같은 키", () => {
    expect(chartKey(buildChart(base))).toBe(chartKey(buildChart(base)));
  });

  it("키는 5개 필드를 | 로 연결한다", () => {
    const key = chartKey(buildChart(base));
    expect(key.split("|")).toHaveLength(5);
    expect(key.endsWith("|male")).toBe(true);
  });

  it("성별이 다르면 키가 다르다", () => {
    const male = chartKey(buildChart({ ...base, gender: "male" }));
    const female = chartKey(buildChart({ ...base, gender: "female" }));
    expect(male).not.toBe(female);
  });

  it("시주 유무가 다르면 키가 다르고, 시주 없으면 none", () => {
    const withHour = chartKey(buildChart(base));
    const noHour = chartKey(buildChart({ ...base, hour: undefined }));
    expect(withHour).not.toBe(noHour);
    expect(noHour.split("|")[3]).toBe("none");
  });
});

describe("luckKey", () => {
  const base = { year: 1990, month: 5, day: 15, gender: "male" } as const;

  it("chartKey 로 시작한다 (원국이 다르면 키가 다르다)", () => {
    const a = analyze({ ...base, hour: 10 });
    expect(luckKey(a, 2026).startsWith(chartKey(a.chart))).toBe(true);
  });

  it("기준 연도가 다르면 키가 다르다 (세운·현재 대운이 해마다 바뀐다)", () => {
    const a = analyze({ ...base, hour: 10 });
    expect(luckKey(a, 2026)).not.toBe(luckKey(a, 2027));
  });

  it("생시가 달라 대운수가 갈리면 키가 다르다", () => {
    const a = analyze({ ...base, hour: 1 });
    const b = analyze({ ...base, hour: 23 });
    expect(luckKey(a, 2026)).not.toBe(luckKey(b, 2026));
  });
});

describe("pillarsJson", () => {
  it("시주 없으면 hour는 null", () => {
    const p = pillarsJson(buildChart({ ...base, hour: undefined }));
    expect(p.hour).toBeNull();
    expect(typeof p.year).toBe("string");
  });
});
