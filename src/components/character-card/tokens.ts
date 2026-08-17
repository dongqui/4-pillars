import type { Element } from "@/lib/saju-core/data/stems";

/**
 * 카드 표면 전용 오행 토큰 (B24 확정값).
 *
 * globals.css 의 `--color-wood` 계열과는 다른 축이다 — 저쪽은 밝은 배경 위의 차트·칩·배지용이고,
 * 이쪽은 딥 서피스 위에 얹는 액센트다. 두 벌을 한 벌로 합치려 하면 대비가 무너진다.
 */
export const CARD_TONES: Record<Element, { surface: string; accent: string; hanja: string }> = {
  목: { surface: "#14352A", accent: "#34D399", hanja: "木" },
  화: { surface: "#351C16", accent: "#F97362", hanja: "火" },
  토: { surface: "#322612", accent: "#F0B542", hanja: "土" },
  금: { surface: "#1E262F", accent: "#A9BCD0", hanja: "金" },
  수: { surface: "#0E2A45", accent: "#4FA3E3", hanja: "水" },
};

/** 라이트 변형의 액센트 — 흰 배경 위라서 기존 오행 차트색을 그대로 쓴다. */
export const CARD_LIGHT_ACCENTS: Record<Element, string> = {
  목: "#2E9E6B",
  화: "#DC5A4B",
  토: "#C99A3F",
  금: "#8492A6",
  수: "#3E6FB0",
};

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgba(hex: string, alpha: number): string {
  return `rgba(${channels(hex).join(",")},${alpha})`;
}

export function mix(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}
