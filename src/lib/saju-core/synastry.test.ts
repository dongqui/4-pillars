import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { analyzeSynastry, synastryLabel } from "./synastry";
import { BADGE_LABELS, RELATION_LABELS } from "./relationship";
import { tenGod } from "./data/relations";
import { STEMS, type Stem } from "./data/stems";
import type { BirthInput } from "./chart";

const birth = (year: number, month: number, day: number, hour = 10): BirthInput => ({
  year, month, day, hour, minute: 0, gender: "male", calendar: "solar",
});

const ey = (s: Stem) => ({ element: STEMS[s].element, yinYang: STEMS[s].yinYang });

const A = analyze(birth(1990, 10, 25));
const B = analyze(birth(1993, 4, 12));

describe("analyzeSynastry", () => {
  it("일간 관계는 방향을 가진다 — 뒤집으면 짝이 되는 분류로 돌아온다", () => {
    const s = analyzeSynastry(A, B);
    const back = analyzeSynastry(B, A);
    expect(s.relation.kind).toBe(back.reverse.kind);
    expect(s.reverse.kind).toBe(back.relation.kind);
  });

  it("배지는 대칭이라 뒤집어도 같다", () => {
    const s = analyzeSynastry(A, B);
    const back = analyzeSynastry(B, A);
    expect([...s.relation.badges]).toEqual([...back.relation.badges]);
  });

  it("합산 오행은 두 원국의 합이다", () => {
    const s = analyzeSynastry(A, B);
    for (const el of ["목", "화", "토", "금", "수"] as const) {
      expect(s.combined[el]).toBe(A.elements.counts[el] + B.elements.counts[el]);
    }
  });

  it("지지 관계는 자리를 남긴다 — 일지×일지는 가중 3", () => {
    const s = analyzeSynastry(A, B);
    for (const tie of s.ties) {
      const isDayDay = tie.subjectPosition === "day" && tie.counterpartPosition === "day";
      expect(tie.weight).toBe(isDayDay ? 3 : tie.subjectPosition === "month" && tie.counterpartPosition === "month" ? 2 : 1);
    }
  });

  it("같은 사람끼리는 동일일주 배지가 붙는다", () => {
    const s = analyzeSynastry(A, A);
    expect(s.relation.badges).toContain("동일일주");
    // 배지가 분류를 덮지 않는다 — 같은 일간이라 분류는 비아이고, 배지는 그 앞에 붙는다.
    expect(s.label).toBe("거울처럼 결이 닮은 쌍");
  });

  it("나이차는 범주값이다 — 숫자를 노출하지 않는다", () => {
    expect(analyzeSynastry(A, analyze(birth(1992, 1, 1))).ageGap).toBe("또래");
    expect(analyzeSynastry(A, analyze(birth(1999, 1, 1))).ageGap).toBe("터울");
    expect(analyzeSynastry(A, analyze(birth(1965, 1, 1))).ageGap).toBe("한 세대 차");
  });

  it("시주가 없으면 그 자리는 관계 판정에서 빠진다", () => {
    // BirthInput.hour 는 number|undefined 라 "없음"은 null 이 아니라 undefined 로 표현한다
    // (src/lib/profiles/to-birth-input.ts 의 time?.hour 와 동일한 관례).
    const noHour = analyze({ ...birth(1993, 4, 12), hour: undefined });
    const s = analyzeSynastry(A, noHour);
    expect(s.ties.every((t) => t.counterpartPosition !== "hour")).toBe(true);
  });

  it("용신 공급은 상대 원국의 글자 수다", () => {
    const s = analyzeSynastry(A, B);
    expect(s.subject.yongsinFromOther).toBe(B.elements.counts[A.yongsin.yongsin]);
    expect(s.counterpart.huisinFromOther).toBe(A.elements.counts[B.yongsin.huisin]);
  });

  it("상대 일간의 십성은 방향을 가진다 — 인자를 바꿔치기하면 값이 달라져야 잡힌다", () => {
    // A/B는 일간(계/계)이 같아 어느 방향으로 넣어도 비견이 나온다 — swap 버그를
    // 못 잡는 조합이다. 일간 오행이 다른 짝(A: 계, C: 신)을 써서 방향성을 확인한다.
    const C = analyze(birth(1988, 6, 15));
    const s = analyzeSynastry(A, C);

    const expectedTenGodOfCForA = tenGod(ey(A.chart.dayMaster), ey(C.chart.dayMaster));
    const expectedTenGodOfAForC = tenGod(ey(C.chart.dayMaster), ey(A.chart.dayMaster));

    expect(expectedTenGodOfCForA).not.toBe(expectedTenGodOfAForC); // 이 짝이 방향성을 실제로 갖는지 자체 확인
    expect(s.subject.tenGodOfOther).toBe(expectedTenGodOfCForA);
    expect(s.counterpart.tenGodOfOther).toBe(expectedTenGodOfAForC);
  });
});

// 라벨은 일간 관계와 지지 배지의 조합이다(설계 결정 6-1). 배지가 분류를 덮으면
// "나를 채워 주는 사람" 과 "나를 다잡는 사람" 이 같은 문구로 접힌다.
describe("synastryLabel", () => {
  it("배지가 없으면 분류만으로 만든다", () => {
    expect(synastryLabel({ kind: "생아", label: "귀인", badges: [] })).toBe("나를 채워 주는 쌍");
  });

  it("같은 배지라도 분류가 다르면 라벨이 다르다", () => {
    const helped = synastryLabel({ kind: "생아", label: "귀인", badges: ["육합"] });
    const pushed = synastryLabel({ kind: "극아", label: "스승", badges: ["육합"] });

    expect(helped).not.toBe(pushed);
    expect(helped).toBe("맞물리며 나를 채워 주는 쌍");
    expect(pushed).toBe("맞물리며 나를 다잡는 쌍");
  });

  it("같은 분류라도 배지가 다르면 라벨이 다르다", () => {
    expect(synastryLabel({ kind: "비아", label: "단짝", badges: ["육합"] })).not.toBe(
      synastryLabel({ kind: "비아", label: "단짝", badges: ["충"] }),
    );
  });

  it("배지 이름(찰떡 · 불꽃 · 쌍둥이)을 되풀이하지 않는다 — 바로 아래 배지 줄과 겹치면 안 된다", () => {
    for (const badge of ["육합", "충", "동일일주"] as const) {
      const label = synastryLabel({ kind: "비아", label: "단짝", badges: [badge] });
      expect(label).not.toContain(BADGE_LABELS[badge].name);
      expect(label).not.toContain(RELATION_LABELS["비아"].name);
    }
  });
});
