import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { chartKey } from "../key";
import { chartFacts, luckFacts } from "./facts";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });

describe("chartFacts", () => {
  it("원국·오행·신강약·용신을 담는다", () => {
    const facts = chartFacts(analysis);
    expect(facts).toContain("일간:");
    expect(facts).toContain("년주");
    expect(facts).toContain("월주");
    expect(facts).toContain("일주");
    expect(facts).toContain("오행 분포:");
    expect(facts).toContain("십성 분포:");
    expect(facts).toContain("신강약:");
    expect(facts).toContain("용신:");
  });

  // 이 섹션들은 chartKey(4기둥+성별)로만 캐시된다. 생년월일이 프롬프트에 섞이면
  // 그 서술이 같은 원국을 가진 다른 사람에게 그대로 나간다.
  it("생년월일·시각이 새지 않는다", () => {
    const facts = chartFacts(analysis);
    expect(facts).not.toContain("1990");
    expect(facts).not.toContain("5월");
    expect(facts).not.toContain("15일");
    expect(facts).not.toContain("10시");
  });

  it("chartKey 가 같으면 사실 블록도 같다", () => {
    // 같은 시주 안에서 분만 다르면 4기둥이 같다 = 캐시를 공유한다.
    const other = analyze({ year: 1990, month: 5, day: 15, hour: 10, minute: 45, gender: "male" });
    expect(chartKey(other.chart)).toBe(chartKey(analysis.chart));
    expect(chartFacts(other)).toBe(chartFacts(analysis));
  });

  it("성별이 다르면 사실 블록도 다르다", () => {
    const female = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "female" });
    expect(chartFacts(female)).not.toBe(chartFacts(analysis));
  });

  it("시주가 없으면 빈 자리임을 알린다", () => {
    const noHour = analyze({ year: 1990, month: 5, day: 15, gender: "male" });
    const facts = chartFacts(noHour);
    expect(facts).toContain("시주: 없음");
    expect(facts).toContain("총 6자");
  });
});

describe("luckFacts", () => {
  const facts = luckFacts(analysis, 2026, 3);

  it("chartFacts 를 포함한다", () => {
    expect(facts.startsWith(chartFacts(analysis))).toBe(true);
  });

  it("대운 회차를 전부 싣는다", () => {
    for (const p of analysis.daeun.periods) {
      expect(facts).toContain(`${p.index}) ${p.pillar}(${p.pillarHanja})`);
    }
  });

  it("요청한 연수만큼 세운 간지를 싣는다", () => {
    expect(facts).toContain("2026년 병오(丙午)");
    expect(facts).toContain("2028년 무신(戊申)");
    expect(facts).not.toContain("2029년");
  });

  it("연도·나이를 서술에 쓰지 말라고 못박는다", () => {
    expect(facts).toContain("서술에 쓰지 마라");
  });

  // 현재 대운 위치는 출생 연도에 의존하는데 luckKey 에는 출생 연도가 없다.
  it("현재 대운 위치를 담지 않는다", () => {
    expect(facts).not.toContain("현재");
  });
});
