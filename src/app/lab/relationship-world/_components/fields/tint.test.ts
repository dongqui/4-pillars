import { describe, it, expect } from "vitest";
import { ROLE_ORDER } from "../../_data/roles";
import { FIELD_TINT } from "./tint";

// tint.ts 는 타입 하나만 import 한다 — three 도 React 도 들이지 않으므로
// vitest 의 environment:"node" 에서 그대로 돈다.

/** #rrggbb → HSL. 브라우저 없이 계산한다. */
function hsl(hex: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`hex 형식이 아니다: ${hex}`);
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

// 설계 3절 "색": 다섯은 좁은 한색 계열 안에 머물고, 차이는 재질에서 나오는
// 색온 정도다. **어떤 Field 도 오행을 지시하지 않는다.** 구분의 부담은 전부
// 형태가 진다. 이 규칙은 지금까지 tint.ts 의 주석에만 있었는데, 주석은 아무도
// 막아주지 않는다 — 실제로 refine(#b6c2d4)은 25.85% 로 상한에서 0.15%p 거리다.
describe("FIELD_TINT — 색이 구분의 부담을 지지 않는다", () => {
  it("5개 역할이 모두 정의돼 있다", () => {
    for (const role of ROLE_ORDER) {
      expect(FIELD_TINT[role]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("다섯 틴트 전부 채도 26% 이하다", () => {
    for (const role of ROLE_ORDER) {
      expect(hsl(FIELD_TINT[role]).s).toBeLessThanOrEqual(0.26);
    }
  });

  // 색상(hue)은 일부러 벌어져 있다 — 설계 3절이 "결정은 차갑게, 안개는 따뜻하게"
  // 라고 못 박았고, fill(#d2cec7)만 난색이라 hue 차이는 178° 다. 채도가 전부
  // 26% 이하라 그 차이가 화면에서는 미묘한 색온으로만 읽힌다. 그러므로 잠가야
  // 할 것은 hue 폭이 아니라 "색만으로 다섯이 갈리지 않는다"는 쪽이다.
  it("어떤 두 틴트도 색만으로 갈릴 만큼 떨어져 있지 않다", () => {
    const rgb = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const cols = ROLE_ORDER.map((r) => rgb(FIELD_TINT[r]));
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const d = Math.hypot(
          cols[i][0] - cols[j][0],
          cols[i][1] - cols[j][1],
          cols[i][2] - cols[j][2],
        );
        expect(d).toBeLessThan(45);
      }
    }
  });

  it("명도도 좁은 대역이다 — 한 Field 만 튀어 보이면 그게 곧 라벨이 된다", () => {
    const ls = ROLE_ORDER.map((r) => hsl(FIELD_TINT[r]).l);
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(0.12);
  });
});
