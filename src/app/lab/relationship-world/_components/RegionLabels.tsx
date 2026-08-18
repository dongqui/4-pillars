"use client";

import { Html } from "@react-three/drei";
import { roleColor } from "../_data/role-colors";
import { ROLE_ICON, ROLE_ORDER, ROLE_REGION_NAME, type RelationRole } from "../_data/roles";
import { ROLE_ANCHORS } from "../_lib/layout";

/**
 * 구역마다 "무슨 관계인지 · 몇 명인지"를 띄우는 배지.
 *
 * 색만으로 다섯 구역이 갈린다는 것이 이 브랜치의 전제였지만, 색은 "이 덩어리가
 * 무엇인가"까지는 말해주지 못한다. 배지는 앵커 위치에 붙는다 — 앵커는 세
 * 소구역 방향의 한가운데라 그 구역의 무게중심에 가장 가깝다.
 *
 * 사람 명패(zIndexRange [30, 0])보다 뒤에 둔다. 겹칠 때 가려야 하는 쪽은
 * 구역 이름이지 사람 이름이 아니다.
 */
export function RegionLabels({ counts }: { counts: Record<RelationRole, number> }) {
  return (
    <group>
      {ROLE_ORDER.map((role) => (
        <Html
          key={role}
          position={ROLE_ANCHORS[role].anchor as unknown as [number, number, number]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 backdrop-blur-[2px] select-none"
            style={{
              borderColor: `${roleColor(role)}55`,
              backgroundColor: "#0f172acc",
              // 배지 글자는 그 구역 색을 그대로 쓴다 — 노드와 같은 색이어야
              // "이 배지가 저 덩어리의 이름"이라는 것이 설명 없이 읽힌다.
              color: roleColor(role),
            }}
          >
            <span className="text-[11px] leading-none">{ROLE_ICON[role]}</span>
            <span className="text-[11px] font-semibold leading-none tracking-[0.02em]">
              {ROLE_REGION_NAME[role]}
            </span>
            <span className="text-[11px] font-bold leading-none tabular-nums opacity-90">
              {counts[role]}
            </span>
          </div>
        </Html>
      ))}
    </group>
  );
}
