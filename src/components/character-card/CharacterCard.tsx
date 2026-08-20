import type { CSSProperties } from "react";
import type { Character } from "@/lib/saju-core/character";
import { CARD_LIGHT_ACCENTS, CARD_TONES, mix, rgba } from "./tokens";

/**
 * 60캐릭터 카드 — 랜딩 스택 · 리빌 · 홈이 모두 이 하나를 쓴다 (B24).
 *
 * 크기를 다루는 방식이 보통 컴포넌트와 다르다. **내부는 항상 1080px 캔버스로 그리고
 * `zoom` 으로 통째로 줄인다.** 폰트 크기를 브레이크포인트마다 다시 잡지 않는 이유는,
 * 그렇게 하면 장면명 한 줄·칩 줄바꿈·한자 위치가 폭마다 따로 놀기 때문이다.
 * 비율은 고정이 아니다 — 높이는 카피 분량이 정한다.
 *
 * `zoomW` 를 `w` 보다 작게 주면 글자 크기와 높이는 그대로 두고 가로만 늘어난다.
 * `w="fill"` 은 그 끝이다 — 바깥 폭을 부모에게 통째로 맡기고 캔버스가 따라 늘어난다.
 * 홈이 이걸 쓰고, 랜딩 스택·리빌은 폭을 px 로 못 박는다(절대 배치·가운데 정렬이라
 * 폭을 안 주면 내용 크기로 쪼그라든다).
 */
export interface CharacterCardProps {
  character: Character;
  /** 카드 바깥 폭(px). `"fill"` 이면 부모가 주는 폭을 그대로 쓴다 */
  w?: number | "fill";
  /** 내부 요소 크기의 기준 폭(px). 생략하면 `w` — `"fill"` 이면 {@link FILL_BASIS} */
  zoomW?: number;
  /** 흰 배경 변형 — 딥 서피스 대신 오행 차트색 액센트를 쓴다 */
  light?: boolean;
}

/**
 * 한자 워터마크에만 쓰는 명조체. `precedence` 를 주면 React 가 <head> 로 올리고
 * 카드가 여러 장 있어도 링크를 하나로 합친다.
 *
 * `&text=` 서브셋을 쓰지 않는다 — 그 경로(fonts.gstatic.com/l/font)는 CORS 헤더를
 * 주지 않아 @font-face 로드가 차단된다. 기본 URL 은 unicode-range 로 잘게 쪼개져
 * 있어서 어차피 한자가 든 조각만 받는다.
 */
const HANJA_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700&display=swap";

/** 1080 캔버스 기준 워터마크 한 글자의 크기 */
const GLYPH = 262;

/** `w="fill"` 일 때 글자 크기의 기준으로 삼는 폭 — 고정폭 기본값과 같게 둔다 */
const FILL_BASIS = 400;

export function CharacterCard({ character, w = 400, zoomW, light = false }: CharacterCardProps) {
  const { family, scene, copy, internal } = character;
  const tone = CARD_TONES[family.element];
  const accent = light ? CARD_LIGHT_ACCENTS[family.element] : tone.accent;

  // zoom 배율은 zoomW 로 정하고, 캔버스 폭은 거기서 역산한다. 그래야 w 만 넓혔을 때
  // 글자가 같이 커지지 않고 가로 여백만 늘어난다. fill 은 역산할 바깥 폭이 없다 —
  // 캔버스 폭을 auto 로 비워 두면 브라우저가 "부모 폭 ÷ zoom" 으로 같은 값을 잡는다.
  const fixedW = w === "fill" ? null : w;
  const scale = (zoomW ?? fixedW ?? FILL_BASIS) / 1080;
  const canvasWidth = fixedW === null ? undefined : Math.round(fixedW / scale);
  const surface = light ? "#fff" : tone.surface;

  // 장면명은 항상 한 줄이다. 줄바꿈 대신 글자 수로 크기를 한 단계 내린다.
  const sceneSize = scene.name.length <= 9 ? 84 : 72;

  const glow: CSSProperties = {
    position: "absolute",
    inset: 0,
    // 가로 반지름을 % 로 준다 — 캔버스 폭이 auto 인 fill 에서도 같은 비율로 퍼진다
    background: light
      ? `radial-gradient(70% 520px at 12% -12%, ` +
        `${rgba(accent, 0.07)} 0%, rgba(255,255,255,0) 66%)`
      : `radial-gradient(82% 600px at 13% -10%, ` +
        `${rgba(accent, 0.16)} 0%, ${rgba(accent, 0.05)} 38%, rgba(0,0,0,0) 70%), ` +
        `linear-gradient(148deg, ${mix(tone.surface, accent, 0.05)} 0%, ${tone.surface} 58%, rgba(0,0,0,.55) 180%)`,
  };

  const glyphStyle: CSSProperties = { height: GLYPH, lineHeight: `${GLYPH}px` };

  return (
    <div
      style={{
        position: "relative",
        flex: "none",
        width: fixedW ?? "100%",
        borderRadius: Math.max(10, Math.round((fixedW ?? FILL_BASIS) * 0.05)),
        overflow: "hidden",
        background: surface,
        border: light ? "1px solid #E5E8ED" : undefined,
      }}
    >
      <link rel="stylesheet" href={HANJA_FONT_HREF} precedence="default" />

      <div
        style={{
          position: "relative",
          width: canvasWidth,
          zoom: scale,
          background: surface,
        }}
      >
        <div style={glow} />

        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 34,
            bottom: -Math.round(GLYPH * 0.22),
            width: GLYPH,
            fontFamily: "'Nanum Myeongjo', 'Noto Serif KR', serif",
            fontWeight: 700,
            fontSize: GLYPH,
            textAlign: "center",
            color: light ? "#0F172A" : "#fff",
            opacity: light ? 0.055 : 0.11,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div style={glyphStyle}>{character.hanja[0]}</div>
          <div style={glyphStyle}>{character.hanja[1]}</div>
        </div>

        <div style={{ position: "relative", padding: 72 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                  color: accent,
                }}
              >
                {family.name} · {family.hanja}
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  lineHeight: 1,
                  padding: "9px 14px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  border: `1.5px solid ${light ? "#E2E8F0" : "rgba(255,255,255,.16)"}`,
                  color: light ? "#94A3B8" : "rgba(255,255,255,.5)",
                }}
              >
                {family.yinYang === "양" ? "陽" : "陰"} · {tone.hanja}
              </span>
            </div>
            <div
              style={{
                fontSize: 27,
                fontWeight: 400,
                lineHeight: 1.4,
                color: light ? "#94A3B8" : "rgba(255,255,255,.56)",
                marginTop: 20,
                wordBreak: "keep-all",
                textWrap: "pretty",
              }}
            >
              {internal.basis}
            </div>
          </div>

          <div style={{ marginTop: 38 }}>
            <h2
              style={{
                fontSize: sceneSize,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.14,
                color: light ? "#0F172A" : "#fff",
                margin: "0 0 20px",
                whiteSpace: "nowrap",
              }}
            >
              {scene.name}
            </h2>
            <p
              style={{
                fontSize: 38,
                fontWeight: 400,
                lineHeight: 1.4,
                color: light ? "#334155" : "rgba(255,255,255,.78)",
                margin: 0,
                wordBreak: "keep-all",
                textWrap: "pretty",
              }}
            >
              {copy.hook}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26 }}>
            {copy.chips.map((chip) => (
              <span
                key={chip}
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  lineHeight: 1,
                  padding: "16px 26px",
                  borderRadius: 999,
                  border: `1.5px solid ${light ? "#E2E8F0" : "rgba(255,255,255,.18)"}`,
                  color: accent,
                }}
              >
                {chip}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 26 }}>
            <p
              style={{
                fontSize: 31,
                fontWeight: 400,
                lineHeight: 1.55,
                color: light ? "#475569" : "rgba(255,255,255,.68)",
                margin: 0,
                wordBreak: "keep-all",
                textWrap: "pretty",
              }}
            >
              {copy.desc}
            </p>
            <p
              style={{
                fontSize: 29,
                fontWeight: 400,
                lineHeight: 1.55,
                color: light ? "#8B98A9" : "rgba(255,255,255,.5)",
                margin: 0,
                wordBreak: "keep-all",
                textWrap: "pretty",
              }}
            >
              {copy.shadow}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
