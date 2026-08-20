"use client";

import { Html } from "@react-three/drei";
import { SELF_POSITION } from "../_lib/layout";
import { SELF_NODE_SCALE } from "../_lib/node-visual";
import { PersonNode } from "./PersonNode";

/**
 * 나도 다른 사람과 같은 규칙을 따른다 — 같은 3층 구조, 같은 색 체계.
 * 다른 것은 크기 하나뿐이다(SELF_NODE_SCALE).
 *
 * 색은 비겁(beside)이다. 나와 나란히 서는 관계가 비겁이므로 나 자신이 그
 * 색상 가족의 원점이다. 상태는 기본 — 나는 나 자신과 六合 하지도 沖 하지도 않는다.
 *
 * 명패는 이름이 아니라 "나" 다. 지도의 중심은 언제나 보는 사람 자신이고, 거기에
 * 이름이 적혀 있으면 다른 스무 명과 같은 층위의 한 명으로 읽힌다. 공유 링크를
 * 받은 사람에게도 이 자리는 "이 지도의 주인" 이지 그 사람의 이름이 아니다 —
 * 주인의 이름은 페이지 제목이 말한다(<이름>님의 관계 지도).
 */
export function SelfCore() {
  return (
    <group>
      <PersonNode
        position={SELF_POSITION}
        role="beside"
        feature="none"
        selected={false}
        dimmed={false}
        nodeScale={SELF_NODE_SCALE}
      />

      <Html
        center
        position={SELF_POSITION as unknown as [number, number, number]}
        zIndexRange={[10, 0]}
      >
        {/*
          -48px 는 근접 halo 를 비껴가는 자리다. halo 반지름은
          STATE_VISUAL.none.nearRadius(0.28) × SELF_NODE_SCALE(5.5) = 1.54 월드,
          진입 화면에서 50px 다. 노드를 더 키우면 이 값도 같이 올려야 한다.
        */}
        <span className="block translate-y-[-48px] text-[13px] font-semibold tracking-[0.14em] text-slate-200/85 select-none">
          나
        </span>
      </Html>
    </group>
  );
}
