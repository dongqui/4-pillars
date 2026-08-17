"use client";

import { Html } from "@react-three/drei";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";
import { SELF_CORE_SCALE } from "../_lib/node-visual";
import { PersonNode } from "./PersonNode";

/**
 * 나도 다른 사람과 같은 규칙을 따른다 — 같은 3층 구조, 같은 사주색.
 * 다른 것은 코어 반지름 하나뿐이다(SELF_CORE_SCALE).
 *
 * 예전에는 파란 발광 구체 + pointLight 였는데, "색 = 그 사람의 사주" 아래에서
 * 나만 역할과 무관한 파란색일 이유가 없다. SELF 의 pillarKey 는 "갑자" 다.
 */
export function SelfCore() {
  return (
    <group>
      <PersonNode
        position={SELF_POSITION}
        pillarKey={SELF.pillarKey}
        selected={false}
        dimmed={false}
        coreScale={SELF_CORE_SCALE}
      />

      {/* 어느 것이 나인지 모르면 관계 지도가 아니다. 이름은 DOM 으로. */}
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
