import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "./roles";
import {
  MAP_BACKGROUND,
  ROLE_HUE,
  nodeColor,
  roleColor,
  roleHsl,
  roleTextColor,
} from "./role-colors";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
// WCAG 상대 휘도·대비. role-colors.ts 의 구현을 import 하지 않고 독립적으로
// 다시 적는다 — 같은 구현끼리 비교하면 변환이 틀려도 통과한다.
function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// 시안(Saju Relationship Map.dc.html) 확정 팔레트. ROLE_HUE 는 이 hex 의 HSL
// 변환값이라, 표가 바뀌면 여기서 잡힌다.
const DESIGN_HEX: Record<(typeof ROLE_ORDER)[number], string> = {
  fill: "#10b981",
  beside: "#f59e0b",
  express: "#8b5cf6",
  move: "#db2760",
  refine: "#0ea5e9",
};

describe("Role hue", () => {
  it("5개 역할 전부에 색이 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_HUE[role]).toBeDefined();
  });

  it("그래픽 색이 시안 hex 를 채널당 ±2/255 안에서 복원한다", () => {
    for (const role of ROLE_ORDER) {
      const got = toRgb(roleColor(role));
      const want = toRgb(DESIGN_HEX[role]);
      got.forEach((v, i) => {
        expect(Math.abs(v - want[i]), `${role} 채널 ${i}`).toBeLessThanOrEqual(2);
      });
    }
  });

  it("hue 간격이 38° 이상이다 — 두 역할이 같은 색으로 읽히면 실패다", () => {
    // 예전 하한은 40° 였다. 시안 팔레트의 초록(160.1°)·하늘(198.6°)이 38.5° 라
    // 시안 hex 유지를 우선해 38 로 내렸다 — 이 두 색은 명도(39 vs 48)로도 갈린다.
    const hues = ROLE_ORDER.map((r) => ROLE_HUE[r].h).sort((a, b) => a - b);
    for (let i = 0; i < hues.length; i++) {
      const gap = i === hues.length - 1 ? 360 - hues[i] + hues[0] : hues[i + 1] - hues[i];
      expect(gap, `${hues[i]}° 다음 간격`).toBeGreaterThanOrEqual(38);
    }
  });

  it("5색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleColor));
    expect(seen.size).toBe(ROLE_ORDER.length);
  });
});

describe("roleTextColor", () => {
  it("라이트 배경 대비 4.5 이상이다 — 색 텍스트의 가독 하한", () => {
    // 그래픽 색에는 대비 하한이 없다(시안 확정 팔레트). 텍스트가 그 색 그대로면
    // #F59E0B 은 1.9:1 이라 읽을 수 없어, 텍스트만 어두운 변형을 쓴다.
    for (const role of ROLE_ORDER) {
      expect(contrast(roleTextColor(role), MAP_BACKGROUND), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("5개 텍스트 색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleTextColor));
    expect(seen.size).toBe(ROLE_ORDER.length);
  });

  it("hue 를 바꾸지 않는다 — 어두워질 뿐 같은 색상 가족이다", () => {
    // hex → hue 를 독립적으로 계산해 ROLE_HUE 의 h 와 비교한다. 명도만 내리는
    // 구현이면 hue 는 ±2° 안에 남는다(정수 반올림 오차).
    const hueOf = (hex: string): number => {
      const [r, g, b] = toRgb(hex).map((v) => v / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return 0;
      let h: number;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const role of ROLE_ORDER) {
      const gap = Math.abs(hueOf(roleTextColor(role)) - ROLE_HUE[role].h);
      expect(Math.min(gap, 360 - gap), role).toBeLessThanOrEqual(2);
    }
  });
});

describe("상태 변조", () => {
  it("상태가 hue 를 바꾸지 않는다 — 같은 역할은 같은 색상 가족이다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(roleHsl(role, feature).h, `${role}/${feature}`).toBe(ROLE_HUE[role].h);
      }
    }
  });

  it("세 상태가 서로 다른 색을 낸다 — 구분되지 않으면 상태가 없는 것과 같다", () => {
    for (const role of ROLE_ORDER) {
      const seen = new Set(FEATURES.map((f) => nodeColor(role, f)));
      expect(seen.size, role).toBe(3);
    }
  });

  it("채도·명도가 0..100 안에 머문다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const { s, l } = roleHsl(role, feature);
        expect(s, `${role}/${feature} s`).toBeGreaterThanOrEqual(0);
        expect(s, `${role}/${feature} s`).toBeLessThanOrEqual(100);
        expect(l, `${role}/${feature} l`).toBeGreaterThanOrEqual(0);
        expect(l, `${role}/${feature} l`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("六合 은 밝아지고 沖 은 채도가 오르거나 명도가 오른다", () => {
    // 沖 의 s+12 는 beside(92.1)·refine(88.7) 에서 100 클램프에 걸린다 — 그
    // 경우에도 l+4 가 있어 세 상태는 구분된다(위 테스트). 여기서는 방향만 잡는다.
    for (const role of ROLE_ORDER) {
      expect(roleHsl(role, "yukhap").l, role).toBeGreaterThan(ROLE_HUE[role].l);
      const chung = roleHsl(role, "chung");
      expect(
        chung.s > ROLE_HUE[role].s || chung.l > ROLE_HUE[role].l,
        `${role} 沖 이 기본보다 어느 축으로도 오르지 않았다`,
      ).toBe(true);
    }
  });

  it("기본은 Role 색 그대로다", () => {
    for (const role of ROLE_ORDER) {
      expect(nodeColor(role, "none")).toBe(roleColor(role));
    }
  });
});
