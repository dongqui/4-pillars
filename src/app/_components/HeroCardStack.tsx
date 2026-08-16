"use client";

import { CharacterCard } from "@/components/character-card/CharacterCard";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import type { Character } from "@/lib/saju-core/character";

interface Props {
  /** 뒤 · 가운데 · 앞 순서의 세 장 */
  cards: [Character, Character, Character];
}

/**
 * 히어로의 카드 3장 스택. 장식이라 스크린리더에서는 숨긴다 —
 * 카드 안의 카피가 히어로 문구보다 먼저 읽히면 첫 문장이 묻힌다.
 */
export function HeroCardStack({ cards }: Props) {
  const vw = useViewportWidth();
  const mobile = vw < MOBILE_MAX;

  // 시안의 폭 계산: 데스크톱은 히어로 2단 중 한 칸(colW)에서 여백을 뺀 값을 상한으로 둔다.
  const colW = Math.max(240, (Math.min(vw, 1120) - 64 - 48) / 2);
  const cardW = mobile ? Math.min(vw - 56, 330) : Math.min(430, Math.round(colW - 56));

  const [back, mid, front] = cards;

  return (
    <div
      aria-hidden
      className="relative flex items-center justify-center [isolation:isolate]"
      style={{ height: Math.round(cardW * (mobile ? 1.0 : 1.08)) }}
    >
      <div
        className="absolute opacity-90 [filter:drop-shadow(0_18px_34px_rgba(15,23,42,.2))]"
        style={{ transform: `rotate(-7deg) translate(${mobile ? "-16px,-30px" : "-26px,-38px"})` }}
      >
        <CharacterCard character={back} w={cardW} />
      </div>
      <div
        className="absolute opacity-[.94] [filter:drop-shadow(0_18px_34px_rgba(15,23,42,.2))]"
        style={{ transform: `rotate(3.5deg) translate(${mobile ? "18px,24px" : "28px,30px"})` }}
      >
        <CharacterCard character={mid} w={cardW} />
      </div>
      <div className="relative z-[2] [filter:drop-shadow(0_26px_46px_rgba(15,23,42,.3))]">
        <CharacterCard character={front} w={cardW} />
      </div>
    </div>
  );
}
