"use client";

import { Html } from "@react-three/drei";
import { roleColor, roleTextColor } from "../_data/role-colors";
import {
  DISPLAY_TITLES,
  ROLE_ORDER,
  type Feature,
  type RelationRole,
} from "../_data/roles";
import { badgeAnchor, type CellCounts, type MapLayout } from "../_lib/radial";

const FEATURES: Feature[] = ["yukhap", "none", "chung"];

/**
 * 15개 칸마다 "무슨 관계인지 · 몇 명인지" 를 띄우는 배지.
 *
 * 색은 "다섯으로 갈렸다" 까지만 말한다. 라이벌과 동지가 같은 파랑인데 이름이
 * 하나뿐이면 그 구분이 사라지므로 칸마다 하나씩 붙인다.
 *
 * **사람이 없는 칸에는 아무것도 그리지 않는다.** 빈 자리에 이름표만 떠 있으면
 * 없는 관계가 있는 것처럼 읽힌다.
 *
 * 자리는 radial.badgeAnchor 가 계산한다 — 옛 구현은 매 프레임 화면공간에서
 * 배지를 밀어내야 했는데(badge-offset.ts), 이제 각 칸이 자기 각도를 소유하고
 * 그 바깥이 비어 있어 밀어낼 이유가 없다.
 */
export function RegionLabels({
  layout,
  counts,
}: {
  layout: MapLayout;
  counts: CellCounts;
}) {
  return (
    <group>
      {ROLE_ORDER.flatMap((role) =>
        FEATURES.map((feature) => {
          const at = badgeAnchor(layout, role, feature);
          if (!at) return null;
          return (
            <Badge
              key={`${role}/${feature}`}
              role={role}
              feature={feature}
              at={at}
              count={counts[role][feature]}
            />
          );
        }),
      )}
    </group>
  );
}

function Badge({
  role,
  feature,
  at,
  count,
}: {
  role: RelationRole;
  feature: Feature;
  at: readonly [number, number, number];
  count: number;
}) {
  return (
    <Html
      position={at as unknown as [number, number, number]}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex w-[52px] items-center justify-center gap-1 whitespace-nowrap rounded-full border py-[2px] select-none"
        style={{
          borderColor: `${roleColor(role)}4d`,
          backgroundColor: "#ffffffe6",
          color: roleTextColor(role),
        }}
      >
        {/*
          w-[52px] 는 radial.test.ts 의 BADGE_BOX 와 같은 값이어야 한다 — 폭을
          글자 수로 어림하지 않고 못 박는 이유가 그것이다.
          그 상자가 겹침 불변식의 기준이라, 여기서 아이콘을 되살리거나 글자를
          키우면 테스트는 초록인데 화면에서는 겹친다. 아이콘(ROLE_ICON)이 빠진
          것도 그래서다 — 15칸이 다 찬 지도에서 이웃 배지 사이 화면 거리가
          모바일 60.8px 이라 88px 짜리 배지는 들어가지 않는다.
        */}
        <span className="text-[9px] font-semibold leading-none tracking-[0.02em]">
          {DISPLAY_TITLES[role][feature]}
        </span>
        <span className="text-[9px] font-bold leading-none tabular-nums opacity-80">
          {count}
        </span>
      </div>
    </Html>
  );
}
