import { describe, expect, it } from "vitest";
import { BRANCHES, paletteFor, STEMS } from "./saju-colors";
import { FRIENDS, SELF } from "./mock-people";

const BACKGROUND = "#0f172a";

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** hex → HSL. 채도·명도 단언을 위해 테스트가 직접 역산한다(구현을 믿지 않는다). */
function toHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

/** 실제 60갑자 — 천간과 지지가 함께 한 칸씩 나아간다. 120개 조합 중 60개만 존재한다. */
const SEXAGENARY = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

describe("paletteFor", () => {
  it("60갑자 전수가 해석되고 core 색이 60개 모두 다르다", () => {
    const cores = SEXAGENARY.map((k) => paletteFor(k).core);
    expect(cores).toHaveLength(60);
    expect(new Set(cores).size).toBe(60);
  });

  it("60갑자가 아닌 조합도 던지지 않는다 — 천간·지지가 각자 유효하면 색이 나온다", () => {
    expect(() => paletteFor("갑축")).not.toThrow();
  });

  it("목록에 없는 글자는 던진다", () => {
    expect(() => paletteFor("한글")).toThrow();
    expect(() => paletteFor("갑")).toThrow();
    expect(() => paletteFor("")).toThrow();
    // '자' 는 지지이지 천간이 아니다 — 0번째 자리에 오면 틀린 것이다.
    expect(() => paletteFor("자갑")).toThrow();
  });

  it("신 을 자리로 구분한다 — 신미의 신은 천간, 무신의 신은 지지다", () => {
    const sinMi = paletteFor("신미");
    const muSin = paletteFor("무신");
    expect(sinMi.glow).not.toBe(muSin.glow);
    // 신미는 금(hue 205), 무신은 토(hue 38)
    expect(Math.round(toHsl(sinMi.glow).h)).toBe(205);
    expect(Math.round(toHsl(muSin.glow).h)).toBe(38);
  });

  it("같은 천간의 12개 일주는 hue 가 같고 (채도, 명도) 쌍이 12개 모두 다르다", () => {
    for (const stem of STEMS) {
      const pairs = BRANCHES.map((b) => {
        const { h, s, l } = toHsl(paletteFor(stem + b).core);
        return { h, key: `${Math.round(s)},${Math.round(l)}` };
      });
      const hues = new Set(pairs.map((p) => Math.round(p.h)));
      expect(hues.size, `${stem}: hue 가 지지에 따라 흔들리면 안 된다`).toBe(1);
      expect(new Set(pairs.map((p) => p.key)).size, `${stem}: 12개 조합`).toBe(12);
    }
  });

  it("core 는 언제나 glow 보다 채도·명도가 높다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      const glow = toHsl(p.glow);
      const core = toHsl(p.core);
      expect(core.s, `${key} 채도`).toBeGreaterThan(glow.s);
      expect(core.l, `${key} 명도`).toBeGreaterThan(glow.l);
    }
  });

  it("선택은 core 보다 밝고, dim 은 core 보다 어둡고 탁하다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      const core = toHsl(p.core);
      expect(toHsl(p.coreSelected).l, `${key}`).toBeGreaterThan(core.l);
      expect(toHsl(p.coreDimmed).l, `${key}`).toBeLessThan(core.l);
      expect(toHsl(p.coreDimmed).s, `${key}`).toBeLessThan(core.s);
    }
  });

  it("dim 에서도 hue 는 살아 있다 — 선택 중에 누가 누구인지 사라지면 안 된다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      expect(Math.round(toHsl(p.coreDimmed).h)).toBe(Math.round(toHsl(p.core).h));
    }
  });

  it("다른 오행끼리는 hue 가 벌어지고, 같은 오행 형제는 hue 가 같다", () => {
    // 갑/을 = 목, 병/정 = 화
    expect(toHsl(paletteFor("갑자").glow).h).toBeCloseTo(toHsl(paletteFor("을축").glow).h, 0);
    expect(
      Math.abs(toHsl(paletteFor("갑자").glow).h - toHsl(paletteFor("병인").glow).h),
    ).toBeGreaterThan(60);
  });

  it("10개 glow 색이 배경 위에서 명도비 4.0 을 넘는다", () => {
    for (const stem of STEMS) {
      const c = contrast(paletteFor(stem + "자").glow, BACKGROUND);
      expect(c, `${stem} 의 명도비 ${c.toFixed(2)}`).toBeGreaterThan(4.0);
    }
  });

  it("glow 채도가 55% 를 넘지 않는다 — 5색 네온으로 보이지 않게 하는 유일한 장치다", () => {
    for (const stem of STEMS) {
      expect(toHsl(paletteFor(stem + "자").glow).s, stem).toBeLessThanOrEqual(55.5);
    }
  });

  it("mock 데이터 21명 전원이 해석된다", () => {
    for (const p of [SELF, ...FRIENDS]) {
      expect(() => paletteFor(p.pillarKey), p.name).not.toThrow();
    }
  });
});
