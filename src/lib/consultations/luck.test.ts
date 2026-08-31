import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { daeunAt, luckFacts, pillarTenGods } from "./luck";

// 1990-10-25 15:20 남성. facts.test.ts 가 쓰는 프로필과 같은 사람이다.
const analysis = analyze({ year: 1990, month: 10, day: 25, hour: 15, minute: 20, gender: "male" });

/** 시각을 인자로 받는 덕에 오늘 날짜와 무관하게 못 박을 수 있다 */
const AT = new Date("2026-08-31T03:00:00.000Z");

describe("pillarTenGods", () => {
  it("천간과 지지를 일간 기준 십성으로 읽는다", () => {
    const read = pillarTenGods("갑", "병오");
    // 갑목 기준 병화는 식신(같은 양), 오화의 본기 정화는 상관(다른 음양)이다.
    expect(read).toBe("천간 병 식신 · 지지 오 상관");
  });

  it("지지는 본기 천간으로 판정한다 — 원국 블록과 같은 규칙이다", () => {
    // 자수의 본기는 계수(음)다. 지지 자체 음양(양)으로 읽으면 편인이 되어
    // 원국 블록의 같은 글자와 어긋난다.
    expect(pillarTenGods("갑", "갑자")).toBe("천간 갑 비견 · 지지 자 정인");
  });

  it("읽을 수 없는 값이면 null 이다", () => {
    expect(pillarTenGods("갑", "")).toBeNull();
    expect(pillarTenGods("갑", "병")).toBeNull();
    expect(pillarTenGods("갑", "봄여름")).toBeNull();
  });
});

describe("daeunAt", () => {
  it("그 순간에 적용 중인 회차를 고른다", () => {
    const { period } = daeunAt(analysis, AT);
    const listed = analysis.daeun.periods.map((p) => p.pillar);
    expect(listed).toContain(period.pillar);
  });

  it("시간이 흐르면 회차가 앞으로만 간다", () => {
    const early = daeunAt(analysis, new Date("2000-01-01T00:00:00.000Z")).period
      .index;
    const late = daeunAt(analysis, new Date("2040-01-01T00:00:00.000Z")).period
      .index;
    expect(late).toBeGreaterThan(early);
  });

  // 대운수 이전(첫 대운이 들기 전)에는 경과가 음수가 된다. 눌러 두지 않으면
  // "후반"이 나올 수도 있는 자리다.
  it("첫 대운이 들기 전에도 초반으로 읽는다", () => {
    const { period, phase } = daeunAt(
      analysis,
      new Date("1990-11-01T00:00:00.000Z"),
    );
    expect(period.index).toBe(1);
    expect(phase).toBe("초반");
  });

  // 위치는 회차 안에서 앞으로만 간다. 회차가 넘어갈 때만 초반으로 되돌아간다.
  // (공식을 테스트에 옮겨 적지 않으려고 훑어서 확인한다)
  it("같은 회차 안에서는 위치가 되돌아가지 않는다", () => {
    const rank = { 초반: 0, 중반: 1, 후반: 2 };
    let prev = daeunAt(analysis, new Date("1991-01-01T00:00:00.000Z"));
    for (let year = 1992; year <= 2060; year += 1) {
      const cur = daeunAt(analysis, new Date(`${year}-01-01T00:00:00.000Z`));
      if (cur.period.index === prev.period.index) {
        expect(rank[cur.phase]).toBeGreaterThanOrEqual(rank[prev.phase]);
      } else {
        expect(cur.period.index).toBe(prev.period.index + 1);
        expect(cur.phase).toBe("초반");
      }
      prev = cur;
    }
  });
});

describe("luckFacts", () => {
  const block = luckFacts(analysis, AT);

  it("대운 · 세운 · 월운 세 줄을 세운다", () => {
    expect(block).toContain("현재 대운");
    expect(block).toContain("올해 세운");
    expect(block).toContain("이번 달 월운");
  });

  it("원국이 아니라 지나가는 것이라고 못박는다 — 대화 설계 §16", () => {
    expect(block).toContain("원국과 섞어 말하지 마라");
  });

  // 이 줄이 없으면 "이번 달 재물의 힘이 강해서 술을 더 찾게 되는 시기예요" 가
  // 나온다. 흐름은 시기의 렌즈이지 지금 겪는 일의 원인이 아니다(대화 설계 §9).
  it("흐름을 고민의 원인으로 단정하지 말라고 못박는다", () => {
    expect(block).toContain("원인을 단정하는 근거가 아니다");
  });

  it("나이를 적지 않는다 — 지금 연도에서 빼면 출생 연도가 된다", () => {
    expect(block).not.toMatch(/\d+세/);
  });

  it("대운 안의 위치는 남긴다", () => {
    expect(block).toMatch(/10년 중 (초반|중반|후반)/);
  });

  it("입춘 전이면 아직 지난 명리 연도다", () => {
    // 2026-01-20 은 달력으로 2026 년이지만 명리로는 아직 2025 년(을사)이다.
    const before = luckFacts(analysis, new Date("2026-01-20T00:00:00.000Z"));
    expect(before).toContain("올해 세운: 을사");
  });

  it("만세력 범위 밖이면 null 이다 — 흐름 때문에 상담이 막히면 안 된다", () => {
    expect(
      luckFacts(analysis, new Date("2400-01-01T00:00:00.000Z")),
    ).toBeNull();
  });
});
