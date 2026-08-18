import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "./roles";
import { ROLE_HUE, nodeColor, roleColor, roleHsl } from "./role-colors";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

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
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const BACKGROUND = "#0f172a"; // World.tsx 의 <color attach="background">

describe("Role hue", () => {
  it("5개 역할 전부에 색이 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_HUE[role]).toBeDefined();
  });

  it("hue 간격이 40° 이상이다 — 두 역할이 같은 색으로 읽히면 실패다", () => {
    const hues = ROLE_ORDER.map((r) => ROLE_HUE[r].h).sort((a, b) => a - b);
    for (let i = 0; i < hues.length; i++) {
      const gap = i === hues.length - 1 ? 360 - hues[i] + hues[0] : hues[i + 1] - hues[i];
      expect(gap, `${hues[i]}° 다음 간격`).toBeGreaterThanOrEqual(40);
    }
  });

  it("배경 대비가 4.5 이상이다", () => {
    for (const role of ROLE_ORDER) {
      expect(contrast(roleColor(role), BACKGROUND), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("5색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleColor));
    expect(seen.size).toBe(ROLE_ORDER.length);
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

  it("六合 은 밝아지고 沖 은 채도가 오른다 — 방향이 반대로 붙으면 잡는다", () => {
    for (const role of ROLE_ORDER) {
      expect(roleHsl(role, "yukhap").l, role).toBeGreaterThan(ROLE_HUE[role].l);
      expect(roleHsl(role, "chung").s, role).toBeGreaterThan(ROLE_HUE[role].s);
    }
  });

  it("기본은 Role 색 그대로다", () => {
    for (const role of ROLE_ORDER) {
      expect(nodeColor(role, "none")).toBe(roleColor(role));
    }
  });
});
