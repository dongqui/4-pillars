export type BrandSize = "xs" | "sm" | "md" | "lg";
/** dark: 밝은 배경 위(어두운 박스 + 흰 막대). light: 어두운 배경 위(흰 박스 + 어두운 막대). */
export type BrandTone = "dark" | "light";

interface SizeSpec {
  box: number;
  radius: number;
  barW: number;
  gap: number;
  bars: [number, number, number, number];
  project: number;
  name: number;
  wordGap: number;
}

// 디자인 시안에서 그대로 옮긴 화면별 치수 — 손대면 시안과 어긋난다.
const SIZES: Record<BrandSize, SizeSpec> = {
  xs: { box: 26, radius: 8, barW: 2.5, gap: 2.5, bars: [6.5, 10.5, 8.5, 13], project: 11, name: 14.5, wordGap: 5 },
  sm: { box: 28, radius: 9, barW: 2.5, gap: 2.5, bars: [7, 11, 9, 14], project: 11.5, name: 15.5, wordGap: 5 },
  md: { box: 30, radius: 10, barW: 2.5, gap: 2.5, bars: [7.5, 12, 9.5, 15], project: 12, name: 16, wordGap: 5 },
  lg: { box: 34, radius: 10, barW: 3, gap: 3, bars: [8.5, 13.5, 11, 17], project: 13, name: 18, wordGap: 6 },
};

// 네 기둥(四柱)을 옅은 톤에서 밝은 톤으로 세운 막대. 마지막 기둥만 꽉 찬 색이다.
const BAR_OPACITY: Record<BrandTone, number[]> = {
  dark: [0.42, 0.62, 0.52, 1],
  light: [0.35, 0.55, 0.45, 1],
};

interface BrandLogoProps {
  size?: BrandSize;
  tone?: BrandTone;
  className?: string;
}

/** 마크(네 기둥) + 워드마크(PROJECT 사주). 링크가 필요하면 AppBrand 로 감싼다. */
export function BrandLogo({ size = "md", tone = "dark", className = "" }: BrandLogoProps) {
  const s = SIZES[size];
  const barRgb = tone === "dark" ? "255, 255, 255" : "17, 24, 39";
  const opacities = BAR_OPACITY[tone];
  const bandHeight = Math.max(...s.bars);

  return (
    <span className={`flex items-center gap-2.5 ${className}`.trim()}>
      <span
        className="flex items-center justify-center"
        style={{
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          background: tone === "dark" ? "#0F172A" : "#FFFFFF",
        }}
      >
        <span className="flex items-end" style={{ gap: s.gap, height: bandHeight }}>
          {s.bars.map((h, i) => (
            <span
              key={i}
              style={{
                width: s.barW,
                height: h,
                borderRadius: s.barW / 2,
                background: `rgba(${barRgb}, ${opacities[i]})`,
              }}
            />
          ))}
        </span>
      </span>
      <span className="flex items-baseline whitespace-nowrap" style={{ gap: s.wordGap }}>
        <span
          className="font-semibold"
          style={{
            fontSize: s.project,
            letterSpacing: "0.09em",
            ...(tone === "dark" ? { color: "#94A3B8" } : { opacity: 0.6 }),
          }}
        >
          PROJECT
        </span>
        <span className="font-bold" style={{ fontSize: s.name, letterSpacing: "-0.03em" }}>
          사주
        </span>
      </span>
    </span>
  );
}
