"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MockPerson } from "../_data/mock-people";
import type { Vec3 } from "../_lib/layout";

type Tier = "full" | "compact" | "dot";

// 경계값은 눈으로 맞춘 값이다. 375px 에서 이름이 겹치기 시작하는 지점이 곧 경계다.
const NEAR = 11;
const FAR = 17;

function tierFor(distance: number): Tier {
  if (distance < NEAR) return "full";
  if (distance < FAR) return "compact";
  return "dot";
}

const ORDER: Tier[] = ["dot", "compact", "full"];

/** 선택된 성운의 사람은 한 단계 올린다. dim 처리와 같은 동작이라 개념이 늘지 않는다. */
function boost(tier: Tier): Tier {
  return ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(tier) + 1)];
}

export function PersonMarker({
  person,
  position,
  selected,
  dimmed,
  boosted,
  onSelect,
}: {
  person: MockPerson;
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
  boosted: boolean;
  onSelect: (id: string) => void;
}) {
  const [tier, setTier] = useState<Tier>("compact");
  const current = useRef<Tier>("compact");
  const world = useRef(new THREE.Vector3(...position));

  useFrame((state) => {
    // 매 프레임 setState 하면 20개가 리렌더를 쏟아낸다. 단계가 바뀔 때만 올린다.
    const next = tierFor(state.camera.position.distanceTo(world.current));
    if (next !== current.current) {
      current.current = next;
      setTier(next);
    }
  });

  const shown = boosted ? boost(tier) : tier;
  const opacity = selected ? 1 : dimmed ? 0.28 : 0.92;

  return (
    <Html
      position={position as unknown as [number, number, number]}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "auto", transition: "opacity 220ms ease", opacity }}
    >
      {shown === "dot" ? (
        <button
          type="button"
          aria-label={person.name}
          onClick={() => onSelect(person.id)}
          className="grid place-items-center w-11 h-11 -m-[14px] cursor-pointer bg-transparent border-0"
        >
          <span
            className={`block w-[7px] h-[7px] rounded-full ${
              selected ? "bg-blue-300" : "bg-slate-300/80"
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(person.id)}
          className={`
            flex items-center justify-center whitespace-nowrap cursor-pointer
            rounded-md border backdrop-blur-[2px] transition-all
            ${
              shown === "full"
                ? "min-h-11 px-3 text-[13px]"
                : "min-h-8 px-2 text-[11px] relative after:absolute after:content-[''] after:-inset-1.5"
            }
            ${
              selected
                ? "border-blue-400/70 bg-blue-500/25 text-white font-semibold"
                : "border-slate-400/25 bg-slate-900/55 text-slate-200 font-medium"
            }
          `}
        >
          {person.name}
        </button>
      )}
    </Html>
  );
}
