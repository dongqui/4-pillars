"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterCard } from "@/components/character-card/CharacterCard";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import { HANDOFF_KEY } from "@/lib/characters/handoff";
import type { Character } from "@/lib/saju-core/character";

interface Props {
  character: Character;
  /** 라이트 퍼널에서 이름은 선택 입력이다 */
  name: string | null;
}

/** 시안의 세 페이즈 — 계산은 이미 끝났고 남은 것은 최소 노출 시간뿐이다 */
const PHASE_1_MS = 1100;
const PHASE_2_MS = 2200;

export function Reveal({ character, name }: Props) {
  const router = useRouter();
  const vw = useViewportWidth();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), PHASE_1_MS);
    const t2 = setTimeout(() => setPhase(2), PHASE_2_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const who = name ? `${name}님의` : "당신의";
  const cardW = vw < MOBILE_MAX ? Math.min(vw - 40, 370) : 470;
  const done = phase >= 2;

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
        <div className="relative flex flex-col items-center px-8 text-center">
          <div className="relative mb-8 h-[86px] w-[86px]">
            <div className="pv-breathe absolute inset-0 rounded-full [background:radial-gradient(circle_at_50%_45%,rgba(255,255,255,.14),rgba(255,255,255,0)_70%)]" />
            <div className="absolute inset-[10px] rounded-full border-[1.5px] border-white/15" />
            <div className="absolute inset-[10px] animate-spin rounded-full border-2 border-transparent border-t-white/70" />
          </div>
          {/* aria-live 로 두 문구를 읽어준다 — 애니메이션을 못 보는 사람에게도 진행 중임이 전해져야 한다 */}
          <div
            aria-live="polite"
            className="pv-fade text-[clamp(20px,3.2vw,24px)] font-bold tracking-[-0.03em] text-white"
          >
            {phase === 0 ? `${who} 사주를 세우고 있어요` : "캐릭터를 찾고 있어요"}
          </div>
        </div>
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
