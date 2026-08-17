import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { analyzeSynastry } from "./synastry";
import type { BirthInput } from "./chart";

const birth = (year: number, month: number, day: number, hour = 10): BirthInput => ({
  year, month, day, hour, minute: 0, gender: "male", calendar: "solar",
});

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
    expect(s.label).toBe("거울 같은 쌍");
  });

  it("나이차는 범주값이다 — 숫자를 노출하지 않는다", () => {
    expect(analyzeSynastry(A, analyze(birth(1992, 1, 1))).ageGap).toBe("또래");
    expect(analyzeSynastry(A, analyze(birth(1999, 1, 1))).ageGap).toBe("터울");
    expect(analyzeSynastry(A, analyze(birth(1965, 1, 1))).ageGap).toBe("한 세대 차");
  });

  it("시주가 없으면 그 자리는 관계 판정에서 빠진다", () => {
    // BirthInput.hour 는 number|undefined 라 "없음"은 null 이 아니라 undefined 로 표현한다
    // (src/app/report/_lib/to-birth-input.ts 의 time?.hour 와 동일한 관례).
    const noHour = analyze({ ...birth(1993, 4, 12), hour: undefined });
    const s = analyzeSynastry(A, noHour);
    expect(s.ties.every((t) => t.counterpartPosition !== "hour")).toBe(true);
  });

  it("용신 공급은 상대 원국의 글자 수다", () => {
    const s = analyzeSynastry(A, B);
    expect(s.subject.yongsinFromOther).toBe(B.elements.counts[A.yongsin.yongsin]);
    expect(s.counterpart.huisinFromOther).toBe(A.elements.counts[B.yongsin.huisin]);
  });
});
