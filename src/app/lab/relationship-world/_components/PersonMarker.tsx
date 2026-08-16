"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MockPerson } from "../_data/mock-people";
import type { Vec3 } from "../_lib/layout";

type Tier = "full" | "compact" | "dot";

// 경계값은 눈으로 맞춘 값이다. 375px 에서 이름이 겹치기 시작하는 지점이 곧 경계다.
// 카메라 거리를 3.077 배로 밀었으므로(camera.ts) 같은 화면상 밀도를 만들려면
// 이 경계도 함께 밀려야 한다. 11/17 을 그대로 두면 20명이 영원히 dot 이다.
// 35/50 은 A(32~48) · B(24~64) · C(16~100) 세 모드 모두에서 full/compact/dot
// 세 단계가 실제로 나온다 — 34/52 로 두면 A 에서 dot 이 안 나온다.
// 기본 진입은 full 2 / compact 18 로, 375px 에 명패 20개를 늘어놓지 않는다.
const NEAR = 35;
const FAR = 50;

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
