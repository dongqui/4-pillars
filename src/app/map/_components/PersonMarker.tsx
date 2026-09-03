"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { nodeColor, roleTextColor } from "../_data/role-colors";
import { DISPLAY_TITLES } from "../_data/roles";
import type { MapPerson } from "../_data/person";
import type { Vec3 } from "../_lib/radial";

export function PersonMarker({
  person,
  position,
  selected,
  dimmed,
  boosted,
  onSelect,
}: {
  person: MapPerson;
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
  boosted: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // 이름은 평소에 없다. 25명 전원의 이름표를 항상 띄우던 것이 이 화면이
  // 읽히지 않던 이유였고, 50명에서는 어떤 배치로도 겹친다.
  const showName = selected || hovered;
  const opacity = selected ? 1 : dimmed ? 0.32 : boosted ? 1 : 0.9;

  return (
    <Html
      position={position as unknown as [number, number, number]}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "auto", transition: "opacity 220ms ease", opacity }}
    >
      <button
        type="button"
        aria-label={`${person.name} ${DISPLAY_TITLES[person.role][person.feature]}`}
        onClick={() => onSelect(person.id)}
        // 터치 브라우저는 곧잘 pointerenter 만 쏘고 짝이 되는 pointerleave 를
        // 안 보낸다 — 한 손가락으로 두 점을 차례로 누르면 두 호버 상태가 눌어
        // 붙어 칩이 둘 다 뜬다. "한 번에 한 명"이 이 화면의 요구라서, 실제로
        // hover 개념이 있는 마우스에서만 이 상태를 켠다. leave 는 꺼도 안전
        // 하니(이미 false 였다면 no-op) 그대로 둔다.
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        // 히트 박스는 점(15px)보다 커야 누르기 쉽지만, 이웃 점과 겹칠 만큼
        // 커지면 안 된다 — 50명 한도에서 레이아웃이 보장하는 점 중심 간 최소
        // 간격은 19px 뿐이다(radial.ts 의 NO_OVERLAP_PX). 박스 한 변이 그
        // 문턱(19px)을 넘으면 이웃한 두 박스가 겹쳐, 그 겹친 틈을 누르면
        // 위에 그려진 쪽이 가로채 버린다 — 원래 겨냥한 사람이 아니라 옆
        // 사람이 선택된다. 18px(그 아래)로 여유를 남긴다. 더 큰 터치 영역이
        // 편하긴 하지만, 엉뚱한 사람이 눌리는 쪽이 더 나쁘다.
        className="relative grid place-items-center w-[18px] h-[18px] -m-[9px] cursor-pointer border-0 bg-transparent p-0"
      >
        {/* 六合 은 은은한 halo, 沖 은 바깥 링. 색은 구역, 형태는 상태다 —
            색 하나로 15칸을 감당하지 않아도 되게 나눠 진다. */}
        {person.feature === "yukhap" && (
          // 점 지름 15px 위에 11px 여유를 둔 26px halo — 점을 가리지 않으면서
          // 은은하게 번지는 정도로, 沖 링(22px)보다 한 단계 크게 잡아 "맑아진다"는
          // 六合 쪽 인상과 맞춘다.
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: 26,
              height: 26,
              backgroundColor: nodeColor(person.role, person.feature),
              opacity: 0.18,
            }}
          />
        )}
        {person.feature === "chung" && (
          // 점 지름 15px 위에 7px 여유를 둔 22px 링 — halo보다 촘촘해 "또렷해진다"는
          // 沖 쪽 인상에 맞춘, 테두리만 있는 형태.
          <span
            aria-hidden
            className="absolute rounded-full border"
            style={{
              width: 22,
              height: 22,
              borderColor: nodeColor(person.role, person.feature),
              opacity: 0.6,
            }}
          />
        )}
        <span
          aria-hidden
          className="block rounded-full border-2 border-white"
          style={{
            width: 15,
            height: 15,
            backgroundColor: nodeColor(person.role, person.feature),
            // 점 테두리(흰 2px) 밖으로 3px 더 두르는 색 링 — 선택 상태를
            // 흰 테두리와 헷갈리지 않게 구분하는 최소 두께다.
            boxShadow: selected
              ? `0 0 0 3px ${nodeColor(person.role, person.feature)}55`
              : undefined,
          }}
        />
      </button>

      {showName && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-center shadow-sm"
          // 점 지름 15 + 흰 테두리 2 위에 1px 여유를 더해 칩이 점에 닿지 않게 띄운다.
          style={{ bottom: 18 }}
        >
          <span className="block text-[12px] font-bold leading-tight text-slate-900">
            {person.name}
          </span>
          <span
            className="block text-[10px] leading-tight"
            style={{ color: roleTextColor(person.role) }}
          >
            {DISPLAY_TITLES[person.role][person.feature]}
          </span>
        </div>
      )}
    </Html>
  );
}
