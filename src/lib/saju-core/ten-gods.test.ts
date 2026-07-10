import { describe, expect, it } from "vitest";
import { buildChart } from "./chart";
import { analyzeTenGods } from "./ten-gods";
import { tenGod } from "./data/relations";

describe("tenGod 분류 규칙 (일간 경=금양 기준)", () => {
  const gyeong = { element: "금", yinYang: "양" } as const;
  it("동오행 동음양 → 비견, 이음양 → 겁재", () => {
    expect(tenGod(gyeong, { element: "금", yinYang: "양" })).toBe("비견");
    expect(tenGod(gyeong, { element: "금", yinYang: "음" })).toBe("겁재");
  });
  it("일간이 생하는 수 → 식신/상관", () => {
    expect(tenGod(gyeong, { element: "수", yinYang: "양" })).toBe("식신");
    expect(tenGod(gyeong, { element: "수", yinYang: "음" })).toBe("상관");
  });
  it("일간이 극하는 목 → 편재/정재", () => {
    expect(tenGod(gyeong, { element: "목", yinYang: "양" })).toBe("편재");
    expect(tenGod(gyeong, { element: "목", yinYang: "음" })).toBe("정재");
  });
  it("일간을 극하는 화 → 편관/정관", () => {
    expect(tenGod(gyeong, { element: "화", yinYang: "양" })).toBe("편관");
    expect(tenGod(gyeong, { element: "화", yinYang: "음" })).toBe("정관");
  });
  it("일간을 생하는 토 → 편인/정인", () => {
    expect(tenGod(gyeong, { element: "토", yinYang: "양" })).toBe("편인");
    expect(tenGod(gyeong, { element: "토", yinYang: "음" })).toBe("정인");
  });
});

describe("analyzeTenGods", () => {
  it("경오·신사·경진·계미 → 일간 제외 십성 분포", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });
    const r = analyzeTenGods(chart);
    expect(r.distribution).toMatchObject({
      비견: 1, 겁재: 1, 상관: 1, 편관: 1, 정관: 1, 편인: 1, 정인: 1,
      식신: 0, 편재: 0, 정재: 0,
    });
    expect(r.groupDistribution).toEqual({ 비겁: 2, 식상: 1, 재성: 0, 관성: 2, 인성: 2 });
    // 일간(일주 천간 경)은 아신으로 십성 null
    const dm = r.cells.find((c) => c.isDayMaster);
    expect(dm?.tenGod).toBeNull();
    expect(dm?.char).toBe("경");
  });
});
