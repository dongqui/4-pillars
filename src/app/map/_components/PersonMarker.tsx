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
        aria-label={person.name}
        onClick={() => onSelect(person.id)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="relative grid place-items-center w-6 h-6 -m-3 cursor-pointer border-0 bg-transparent p-0"
      >
        {/* 六合 은 은은한 halo, 沖 은 바깥 링. 색은 구역, 형태는 상태다 —
            색 하나로 15칸을 감당하지 않아도 되게 나눠 진다. */}
        {person.feature === "yukhap" && (
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
            boxShadow: selected
              ? `0 0 0 3px ${nodeColor(person.role, person.feature)}55`
              : undefined,
          }}
        />
      </button>

      {showName && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-center shadow-sm"
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
