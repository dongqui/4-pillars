"use client";

import { Html } from "@react-three/drei";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";
import { SELF_NODE_SCALE } from "../_lib/node-visual";
import { PersonNode } from "./PersonNode";

/**
 * 나도 다른 사람과 같은 규칙을 따른다 — 같은 3층 구조, 같은 색 체계.
 * 다른 것은 크기 하나뿐이다(SELF_NODE_SCALE).
 *
 * 색은 비겁(beside)이다. 나와 나란히 서는 관계가 비겁이므로 나 자신이 그
 * 색상 가족의 원점이다. 상태는 기본 — 나는 나 자신과 六合 하지도 沖 하지도 않는다.
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
        <span className="block translate-y-[-34px] text-[12px] font-semibold tracking-[0.14em] text-slate-200/85 select-none">
          {SELF.name}
        </span>
      </Html>
    </group>
  );
}
