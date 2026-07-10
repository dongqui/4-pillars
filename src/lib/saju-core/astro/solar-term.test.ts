import { describe, expect, it } from "vitest";
import {
  MONTH_TERMS,
  solarTermDate,
  solarTermJD,
  solarTermJDE,
  sunApparentLongitude,
} from "./solar-term";

describe("solarTermJDE 솔버 자기일관성", () => {
  // 구한 순간의 태양 황경이 목표값과 일치해야 한다 (근치 < 0.0001°)
  it.each([1925, 1990, 2024, 2050])("%i년 12절기 모두 황경 수렴", (year) => {
    for (const t of MONTH_TERMS) {
      const jde = solarTermJDE(year, t.longitude);
      const lon = sunApparentLongitude(jde);
      let diff = lon - t.longitude;
      diff = (((diff + 180) % 360) + 360) % 360 - 180;
      expect(Math.abs(diff)).toBeLessThan(1e-4);
    }
  });
});

describe("solarTermDate 정확도 (알려진 실제 KST 값 근사)", () => {
  it("입춘 2024 ≈ 2/4 17시대 (한국천문연구원 17:27)", () => {
    const t = solarTermDate(2024, 315);
    expect(t.month).toBe(2);
    expect(t.day).toBe(4);
    expect(t.hour).toBe(17); // 17:20 계산 (실제 17:27, ~7분 이내)
  });
});

describe("절기 시각은 연중 단조 증가", () => {
  it("입춘<경칩<...<대설 (같은 해 JD 증가)", () => {
    const year = 2000;
    // 소한(285)은 연초라 제외하고 입춘~대설 순서 검증
    const terms = MONTH_TERMS.filter((t) => t.name !== "소한");
    const jds = terms.map((t) => solarTermJD(year, t.longitude));
    for (let i = 1; i < jds.length; i++) {
      expect(jds[i]).toBeGreaterThan(jds[i - 1]);
    }
  });
});
