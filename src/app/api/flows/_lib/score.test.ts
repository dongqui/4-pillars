import { describe, expect, it } from "vitest";
import type { Yongsin } from "@/lib/saju-core";
import { frictionOf, parsePillar2, relationsOf, supportOf, weightTotal } from "./score";

// 용신 화, 희신 목. 화를 극하는 것은 수다.
const yongsin: Yongsin = {
  method: "억부",
  basis: "신약",
  yongsin: "화",
  huisin: "목",
  reason: "테스트",
};

describe("parsePillar2", () => {
  it("두 글자 간지를 천간과 지지로 가른다", () => {
    expect(parsePillar2("병오")).toEqual({ stem: "병", branch: "오" });
  });

  it("모양이 아니면 null", () => {
    expect(parsePillar2("병")).toBeNull();
    expect(parsePillar2("가나")).toBeNull();
  });
});

describe("supportOf", () => {
  it("천간·지지가 둘 다 용신이면 최대치 +1 이다", () => {
    // 병(화) + 오(화) — 둘 다 용신
    expect(supportOf(parsePillar2("병오")!, yongsin)).toBe(1);
  });

  it("둘 다 용신을 극하면 최소치 −1 이다", () => {
    // 임(수) + 자(수) — 화를 극한다
    expect(supportOf(parsePillar2("임자")!, yongsin)).toBe(-1);
  });

  it("희신은 용신의 절반으로 센다", () => {
    // 갑(목) + 인(목) — 둘 다 희신 → (0.5 + 0.5) / 2
    expect(supportOf(parsePillar2("갑인")!, yongsin)).toBeCloseTo(0.5);
  });

  it("무관한 오행은 0 이다", () => {
    // 경(금) + 신(금) — 용신도 희신도 아니고 화를 극하지도 않는다
    expect(supportOf(parsePillar2("경신")!, yongsin)).toBe(0);
  });

  it("언제나 −1 과 +1 사이다", () => {
    for (const p of ["병오", "임자", "갑인", "경신", "무진", "계축"]) {
      const v = supportOf(parsePillar2(p)!, yongsin);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("frictionOf", () => {
  const targets = {
    natal: ["자", "축", "인", "묘"] as const,
    sewun: "오" as const,
    daeun: "미" as const,
  };

  it("충이 많을수록 커진다", () => {
    // 오는 자와 충. 자는 원국 년지(가중 1.5)에 있다.
    const withChung = frictionOf("오", { ...targets, natal: ["자", "축", "인", "묘"] });
    const without = frictionOf("술", { ...targets, natal: ["자", "축", "인", "묘"] });
    expect(withChung).toBeGreaterThan(without);
  });

  it("육합은 흔들림을 줄인다 — 음수 기여다", () => {
    // 축은 자와 육합
    expect(frictionOf("축", { natal: ["자", "자", "자", "자"], sewun: "자", daeun: "자" }))
      .toBeLessThan(0);
  });

  it("아무 관계도 없으면 0 이다", () => {
    expect(frictionOf("자", { natal: ["자", "자", "자", "자"], sewun: "자", daeun: "자" })).toBe(0);
  });

  it("자리 가중이 다르다 — 같은 충이라도 월지가 년지보다 무겁다", () => {
    // natal 순서는 [년, 월, 일, 시]
    const atMonth = frictionOf("오", { natal: ["신", "자", "신", "신"], sewun: "신", daeun: "신" });
    const atYear = frictionOf("오", { natal: ["자", "신", "신", "신"], sewun: "신", daeun: "신" });
    expect(atMonth).toBeGreaterThan(atYear);
  });
});

describe("relationsOf", () => {
  const targets = {
    // 자·오 충 / 인·해 육합 을 일부러 만든다
    natal: ["자", "축", "인", "묘"],
    sewun: "오",
    daeun: "해",
  } as const;

  it("어떤 자리와 어떤 관계인지를 이름으로 돌려준다", () => {
    const rel = relationsOf("오", targets);
    expect(rel).toContainEqual({ target: "년지", kind: "충" });
  });

  it("관계가 없으면 빈 배열이다", () => {
    // 묘는 축과 쌍 관계가 없다(branch-relations.ts 표로 확인). 원안의 "진"은
    // 진·축이 파(破) 관계라 빈 배열 기대치가 틀렸다.
    expect(relationsOf("묘", { natal: ["축"], sewun: "축", daeun: "축" })).toEqual([]);
  });

  it("시지가 없는 프로필은 시지 항목을 내지 않는다", () => {
    const rel = relationsOf("오", { natal: ["자", "축", "인"], sewun: "미", daeun: "미" });
    expect(rel.every((r) => r.target !== "시지")).toBe(true);
  });
});

describe("weightTotal", () => {
  it("네 기둥이 다 있으면 12 다", () => {
    expect(weightTotal({ natal: ["자", "축", "인", "묘"], sewun: "진", daeun: "사" })).toBe(12);
  });

  it("시지가 없으면 시지 가중(1.5)만큼 줄어든다", () => {
    expect(weightTotal({ natal: ["자", "축", "인"], sewun: "진", daeun: "사" })).toBe(10.5);
  });
});

describe("frictionOf — 시간 미상 보정", () => {
  it("같은 관계 구성이면 시지 유무와 무관하게 같은 크기가 나온다", () => {
    // 분자가 0이 아니면 시지 유무로 분모(weightTotal)만 달라져도 값이 갈린다 —
    // 그래서 branch("오")가 나머지 다섯 자리(년·월·일·세운·대운) 그리고 시지
    // 후보 모두와 쌍 관계·삼합 어느 쪽으로도 얽히지 않게 골랐다(표로 확인 완료).
    // 원안의 natal ["자","인","묘"]는 자(오와 충)·묘(오와 파)가 이미 있어
    // 분자가 0이 아니었고, 그래서 축을 다른 지지로 바꿔도 통과할 수 없었다.
    const withHour = frictionOf("오", {
      natal: ["진", "인", "사", "해"],
      sewun: "신",
      daeun: "유",
    });
    const withoutHour = frictionOf("오", {
      natal: ["진", "인", "사"],
      sewun: "신",
      daeun: "유",
    });
    expect(withoutHour).toBeCloseTo(withHour, 10);
  });
});
