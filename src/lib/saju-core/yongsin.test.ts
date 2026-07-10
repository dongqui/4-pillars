import { describe, expect, it } from "vitest";
import { buildChart } from "./chart";
import { selectYongsin } from "./yongsin";
import type { StrengthScore } from "./strength";

// 일간 경(庚, 금). 비겁=금, 인성=토, 식상=수, 재성=목, 관성=화
const gyeongChart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });

function strength(partial: { ratio: number; groupScores: Record<string, number> }): StrengthScore {
  const g = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0, ...partial.groupScores } as StrengthScore["groupScores"];
  const supportive = g.비겁 + g.인성;
  const draining = g.식상 + g.재성 + g.관성;
  return {
    groupScores: g,
    supportive,
    draining,
    ratio: partial.ratio,
    level: partial.ratio >= 0.55 ? "신강" : partial.ratio <= 0.45 ? "신약" : "중화",
  };
}

describe("selectYongsin (억부, 일간 금)", () => {
  it("신약·재성 과다 → 용신 비겁(금), 희신 토", () => {
    const y = selectYongsin(gyeongChart, strength({ ratio: 0.3, groupScores: { 재성: 5, 관성: 1 } }));
    expect(y.yongsin).toBe("금");
    expect(y.huisin).toBe("토"); // 토생금
  });

  it("신약·관성 과다 → 용신 인성(토), 희신 화", () => {
    const y = selectYongsin(gyeongChart, strength({ ratio: 0.3, groupScores: { 관성: 5, 식상: 1 } }));
    expect(y.yongsin).toBe("토");
    expect(y.huisin).toBe("화"); // 화생토
  });

  it("신강·인성 과다 → 용신 재성(목), 희신 수", () => {
    const y = selectYongsin(gyeongChart, strength({ ratio: 0.7, groupScores: { 인성: 5, 비겁: 2 } }));
    expect(y.yongsin).toBe("목");
    expect(y.huisin).toBe("수"); // 수생목
  });

  it("신강·비겁 과다 → 용신 식상(수), 희신 금", () => {
    const y = selectYongsin(gyeongChart, strength({ ratio: 0.7, groupScores: { 비겁: 5, 인성: 1 } }));
    expect(y.yongsin).toBe("수");
    expect(y.huisin).toBe("금"); // 금생수
  });

  it("실제 원국(중화 ratio 0.5, 인성>비겁) → 용신 목, 희신 수", () => {
    const y = selectYongsin(gyeongChart, strength({ ratio: 0.5, groupScores: { 비겁: 2, 인성: 3.5, 관성: 4.5, 식상: 1 } }));
    expect(y.yongsin).toBe("목");
    expect(y.huisin).toBe("수");
  });
});
