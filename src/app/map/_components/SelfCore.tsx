"use client";

import { Html } from "@react-three/drei";
import { SELF_POSITION } from "../_lib/radial";

/**
 * 지도의 중심. 다섯 구역 어디에도 속하지 않으므로 색은 프라이머리
 * 블루(#2563EB)다 — 예전엔 비겁 색이었는데, 라이트 팔레트에서 비겁이
 * 주황이 되면서 나까지 주황이면 다섯 구역 중 하나의 사람으로 읽힌다.
 *
 * 적히는 것은 이름이 아니라 "나" 다. 지도의 중심은 언제나 보는 사람
 * 자신이고, 거기 이름이 있으면 다른 스무 명과 같은 층위의 한 명으로 읽힌다.
 * 공유 링크를 받은 사람에게도 이 자리는 "이 지도의 주인" 이다 — 주인의
 * 이름은 페이지 제목이 말한다(<이름>님의 관계 지도).
 */
export function SelfCore() {
  return (
    <Html
      center
      position={SELF_POSITION as unknown as [number, number, number]}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className="relative grid place-items-center">
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{ width: 92, height: 92, backgroundColor: "#2563EB", opacity: 0.08 }}
        />
        <span
          className="grid h-[52px] w-[52px] place-items-center rounded-full text-[15px] font-bold text-white select-none"
          style={{
            background: "radial-gradient(circle at 35% 30%, #7EB3FF, #2563EB)",
          }}
        >
          나
        </span>
      </div>
    </Html>
  );
}
