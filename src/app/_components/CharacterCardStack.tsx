"use client";

import { CharacterCard } from "@/components/character-card/CharacterCard";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import { CHARACTER_KEYS } from "@/lib/saju-core/data/characters-60";
import type { Character } from "@/lib/saju-core/character";

interface Props {
  /** 왼쪽 뒤 · 앞 · 오른쪽 뒤 순서의 세 장 */
  cards: [Character, Character, Character];
}

/**
 * 캐릭터 섹션의 카드 세 장. 앞장만 흐름에 남기고 뒤 두 장을 절대 배치로 깐다 —
 * 카드 높이는 카피 분량이 정하므로(1080 캔버스를 zoom 으로 줄인다) 컨테이너 높이를
 * 숫자로 박으면 문장이 긴 캐릭터에서 잘린다. 앞장이 높이를 만들게 두면 어긋나지 않는다.
 *
 * 장식이라 스크린리더에서는 숨긴다 — 카드 안의 카피가 섹션 제목보다 먼저 읽히면
 * "60가지 중 나를 닮은 한 장"이라는 요점이 묻힌다.
 */
export function CharacterCardStack({ cards }: Props) {
  const vw = useViewportWidth();
  const mobile = vw < MOBILE_MAX;

  // 시안: 앞장 330 · 뒷장 300 · 뒷장을 좌우로 62px 씩 민다(모바일은 그만큼 좁힌다).
  const frontW = mobile ? Math.min(vw - 88, 300) : 330;
  const backW = Math.round(frontW * 0.91);
  const offset = mobile ? 34 : 62;
  // 세로 겹침은 폭에서 잡는다. 시안의 76px 은 세로로 긴 목업 카드(330×440) 기준인데
  // 실제 카드는 가로형(330×215)이라 그대로 쓰면 뒷장이 위로 안 보인다.
  const drop = Math.round(frontW * 0.1);

  const [left, front, right] = cards;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[460px] [isolation:isolate]">
      <div
        className="absolute left-1/2 top-0 z-[2] opacity-95 [filter:drop-shadow(0_14px_30px_rgba(15,23,42,.28))]"
        style={{ transform: `translateX(calc(-50% - ${offset}px)) rotate(-4deg)` }}
      >
        <CharacterCard character={left} w={backW} />
      </div>
      <div
        className="absolute left-1/2 top-0 z-[2] opacity-95 [filter:drop-shadow(0_14px_30px_rgba(15,23,42,.28))]"
        style={{ transform: `translateX(calc(-50% + ${offset}px)) rotate(4deg)` }}
      >
        <CharacterCard character={right} w={backW} />
      </div>

      <div
        className="relative z-[3] flex justify-center [filter:drop-shadow(0_30px_60px_rgba(15,23,42,.42))]"
        style={{ marginTop: drop }}
      >
        <CharacterCard character={front} w={frontW} />
      </div>

      <div className="relative z-[4] mt-[38px] flex items-center justify-center gap-2 text-xs text-slate-400">
        <span className="font-mono tracking-[0.04em] text-slate-500">
          {front.id + 1} / {CHARACTER_KEYS.length}
        </span>
        <span>{CHARACTER_KEYS.length}가지 중 한 장</span>
      </div>
    </div>
  );
}
