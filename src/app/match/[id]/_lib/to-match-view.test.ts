import { describe, expect, it } from "vitest";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import { toMatchHeroView } from "./to-match-view";

const a = analyze({ year: 1990, month: 10, day: 25, hour: 10, minute: 0, gender: "male", calendar: "solar" });
const b = analyze({ year: 1993, month: 4, day: 12, hour: 10, minute: 0, gender: "female", calendar: "solar" });

const args = {
  synastry: analyzeSynastry(a, b),
  relation: { type: "lover", subjectRole: null, counterpartRole: null } as const,
  subjectName: "김동진",
  counterpartName: "백상현",
};

describe("toMatchHeroView", () => {
  it("단계 라벨과 관계 이름을 함께 낸다", () => {
    const view = toMatchHeroView(args);
    expect(view.label).toBe(args.synastry.label);
    expect(view.relationLabel).toBe("연인");
  });

  it("첫 배지는 관계 분류다 — 배지가 없어도 보여줄 것이 남는다", () => {
    const view = toMatchHeroView({ ...args, synastry: analyzeSynastry(a, b) });
    expect(view.badges.length).toBeGreaterThan(0);
    expect(view.badges[0].hint.length).toBeGreaterThan(0);
  });

  it("이니셜은 이름 첫 글자다", () => {
    const view = toMatchHeroView(args);
    expect(view.subject.initial).toBe("김");
    expect(view.counterpart.initial).toBe("백");
  });

  it("같은 사람이면 동일일주 배지가 함께 나온다", () => {
    const view = toMatchHeroView({ ...args, synastry: analyzeSynastry(a, a) });
    expect(view.badges.map((x) => x.name)).toContain("쌍둥이");
  });
});
