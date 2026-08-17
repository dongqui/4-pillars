"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterCard } from "@/components/character-card/CharacterCard";
import { CharacterLoadingBlock } from "@/components/CharacterLoading";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import { HANDOFF_KEY } from "@/lib/characters/handoff";
import type { Character } from "@/lib/saju-core/character";

interface Props {
  character: Character;
  name: string;
}

/**
 * 퍼널의 계산 화면에서 이어지는 두 번째 문구와 공개.
 *
 * 계산은 이미 끝났다 — 이 1.1초는 대기가 아니라 최소 노출이다. 퍼널이 같은 배경에서
 * 첫 문구를 1.1초 보여주므로 사용자가 보는 것은 합쳐서 2.2초짜리 한 장면이다.
 */
const REVEAL_MS = 1100;

export function Reveal({ character, name }: Props) {
  const router = useRouter();
  const vw = useViewportWidth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const who = name.trim() ? `${name.trim()}님의` : "당신의";
  const cardW = vw < MOBILE_MAX ? Math.min(vw - 40, 370) : 470;

  function goHome() {
    // 홈이 카드를 이어받는 연출을 켜는 신호. 쿼리 파라미터로 넘기면 새로고침이나
    // 링크 공유 때마다 다시 재생되므로 한 번 쓰고 지우는 값으로 둔다.
    try {
      sessionStorage.setItem(HANDOFF_KEY, "1");
    } catch {
      // 사파리 프라이빗 모드 등 — 연출만 빠지고 이동은 그대로 한다
    }
    router.push("/home");
  }

  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-900 py-14">
      <div
        aria-hidden
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(680px 560px at 50% ${done ? "22%" : "50%"}, rgba(255,255,255,${
            done ? ".10" : ".07"
          }) 0%, rgba(255,255,255,0) 68%)`,
        }}
      />

      {!done ? (
        <CharacterLoadingBlock line="캐릭터를 찾고 있어요" />
      ) : (
        <div className="relative flex w-full flex-col items-center px-5">
          <div className="pv-fade mb-5 text-[13px] font-semibold tracking-[0.1em] text-white/45">
            {who} 사주 캐릭터
          </div>
          <div className="pv-cardin">
            <CharacterCard character={character} w={cardW} />
          </div>
          <button
            type="button"
            onClick={goHome}
            className="pv-rise mt-7 rounded-[14px] bg-white px-[30px] py-4 text-base font-semibold text-slate-900 hover:opacity-90"
          >
            시작하기
          </button>
        </div>
      )}
    </main>
  );
}
