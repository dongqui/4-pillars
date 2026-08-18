import { describe, expect, it } from "vitest";
import {
  BRANCH_CHUNG,
  BRANCH_HAE,
  BRANCH_HAP,
  BRANCH_HYEONG,
  BRANCH_ORDER,
  BRANCH_PA,
  BRANCH_SAMHAP,
  BRANCH_WONJIN,
  type Branch,
} from "./branches";

/** a→b 면 b→a 여야 한다. 비대칭인 표는 판정이 방향에 따라 갈려 조용히 틀린다. */
function expectSymmetric(table: Record<Branch, Branch>) {
  for (const b of BRANCH_ORDER) expect(table[table[b]]).toBe(b);
}

describe("1:1 관계표", () => {
  it("육합·충·해·파·원진은 대칭이다", () => {
    for (const t of [BRANCH_HAP, BRANCH_CHUNG, BRANCH_HAE, BRANCH_PA, BRANCH_WONJIN]) {
      expectSymmetric(t);
    }
  });

  it("자기 자신과 짝이 되지 않는다", () => {
    for (const t of [BRANCH_HAP, BRANCH_CHUNG, BRANCH_HAE, BRANCH_PA, BRANCH_WONJIN]) {
      for (const b of BRANCH_ORDER) expect(t[b]).not.toBe(b);
    }
  });

  it("육해 여섯 쌍", () => {
    expect(BRANCH_HAE.자).toBe("미");
    expect(BRANCH_HAE.축).toBe("오");
    expect(BRANCH_HAE.인).toBe("사");
    expect(BRANCH_HAE.묘).toBe("진");
    expect(BRANCH_HAE.신).toBe("해");
    expect(BRANCH_HAE.유).toBe("술");
  });

  it("육파 여섯 쌍", () => {
    expect(BRANCH_PA.자).toBe("유");
    expect(BRANCH_PA.축).toBe("진");
    expect(BRANCH_PA.인).toBe("해");
    expect(BRANCH_PA.묘).toBe("오");
    expect(BRANCH_PA.사).toBe("신");
    expect(BRANCH_PA.미).toBe("술");
  });

  it("원진 여섯 쌍", () => {
    expect(BRANCH_WONJIN.자).toBe("미");
    expect(BRANCH_WONJIN.축).toBe("오");
    expect(BRANCH_WONJIN.인).toBe("유");
    expect(BRANCH_WONJIN.묘).toBe("신");
    expect(BRANCH_WONJIN.진).toBe("해");
    expect(BRANCH_WONJIN.사).toBe("술");
  });
});

describe("삼합", () => {
  it("자기 자신을 담지 않고, 셋이 한 국을 이룬다", () => {
    for (const b of BRANCH_ORDER) {
      const [x, y] = BRANCH_SAMHAP[b];
      expect(x).not.toBe(b);
      expect(y).not.toBe(b);
      // 국의 세 지지는 서로를 가리킨다 — 어느 글자에서 출발해도 같은 세 글자가 나온다
      expect(new Set([x, ...BRANCH_SAMHAP[x]])).toEqual(new Set([b, x, y]));
      expect(new Set([y, ...BRANCH_SAMHAP[y]])).toEqual(new Set([b, x, y]));
    }
  });

  it("네 국", () => {
    expect(new Set(BRANCH_SAMHAP.신)).toEqual(new Set(["자", "진"])); // 수국
    expect(new Set(BRANCH_SAMHAP.해)).toEqual(new Set(["묘", "미"])); // 목국
    expect(new Set(BRANCH_SAMHAP.인)).toEqual(new Set(["오", "술"])); // 화국
    expect(new Set(BRANCH_SAMHAP.사)).toEqual(new Set(["유", "축"])); // 금국
  });
});

describe("형", () => {
  it("대칭이다", () => {
    for (const b of BRANCH_ORDER) {
      for (const other of BRANCH_HYEONG[b]) {
        expect(BRANCH_HYEONG[other]).toContain(b);
      }
    }
  });

  it("자형은 자기 자신을 담는다", () => {
    for (const b of ["진", "오", "유", "해"] as const) {
      expect(BRANCH_HYEONG[b]).toContain(b);
    }
  });

  it("삼형 두 벌", () => {
    expect(new Set(BRANCH_HYEONG.인)).toEqual(new Set(["사", "신"]));
    expect(new Set(BRANCH_HYEONG.축)).toEqual(new Set(["술", "미"]));
  });

  it("자묘 상형", () => {
    expect(BRANCH_HYEONG.자).toEqual(["묘"]);
    expect(BRANCH_HYEONG.묘).toEqual(["자"]);
  });
});
