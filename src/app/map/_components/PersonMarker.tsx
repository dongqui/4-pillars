"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { roleColor } from "../_data/role-colors";
import type { MapPerson } from "../_data/person";
import type { Vec3 } from "../_lib/layout";
import { PersonNode } from "./PersonNode";

type Tier = "full" | "compact" | "dot";

// 경계값은 눈으로 맞춘 값이다. 375px 에서 이름이 겹치기 시작하는 지점이 곧 경계다.
// 진입 거리가 41 → 26 으로 줄었으므로(camera.ts) 같은 화면상 밀도를 만들려면
// 이 경계도 같은 비율(26/40 = 0.65)로 내려야 한다. 35/50 을 그대로 두면
// 기본 진입에서도, A 모드 전체에서도 20명이 전부 full 로 뜬다.
// 23/33 은 기본 진입에서 dot 0 · full 다수로, "이름이 더 명확해야 한다"는
// 설계 문서 5절 의도를 satisfy 한다. dot 은 여전히 죽은 코드가 아니다 — A 모드
// 최대 줌, B·C 모드 최대 줌에서 실제로 나온다.
const NEAR = 23;
// 앵커의 깊이는 20.86~33.16 이고 관성 사람들은 32.07~32.66 에 놓인다.
// FAR = 33 이면 관성 2명이 진입 화면에서 전부 dot 이 되어 이름이 안 보인다 —
// 명패 티어가 Role 과 상관관계를 갖는 것은 의도가 아니다. dot 은 여전히
// 죽은 코드가 아니다(C 모드 최대 줌아웃 65).
const FAR = 36;

// 명패는 노드보다 위에 떠야 하지만, world-space Y 오프셋으로 만들면 C 모드
// (minPolar 15°~maxPolar 140°)에서 world Y 축이 시선축에 거의 나란해지는
// 각도가 나온다 — 화면 중앙이 아닌 사람은 그 순간 오프셋이 옆으로 새어(parallax)
// 명패가 노드 위가 아니라 대각선으로 어긋난다. 그래서 오프셋을 화면공간(px)으로
// 준다: 카메라 각도·줌과 무관하게 항상 화면상 수직으로 위에 뜬다.
const LABEL_LIFT_PX = 32;

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
  person: MapPerson;
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
  boosted: boolean;
  onSelect: (id: string) => void;
}) {
  const [tier, setTier] = useState<Tier>("compact");
  const current = useRef<Tier>("compact");
  // 지연 초기화: useRef(new THREE.Vector3(...)) 로 쓰면 매 렌더마다 새
  // Vector3 를 만들고 버리면서도(ref 는 첫 값만 쓴다) 그 할당 자체는 매번
  // 일어난다. 아래 패턴은 최초 렌더에서 딱 한 번만 만든다.
  const world = useRef<THREE.Vector3 | null>(null);
  if (world.current === null) world.current = new THREE.Vector3(...position);

  useFrame((state) => {
    // 매 프레임 setState 하면 20개가 리렌더를 쏟아낸다. 단계가 바뀔 때만 올린다.
    const next = tierFor(state.camera.position.distanceTo(world.current!));
    if (next !== current.current) {
      current.current = next;
      setTier(next);
    }
  });

  const shown = boosted ? boost(tier) : tier;
  const opacity = selected ? 1 : dimmed ? 0.28 : 0.92;

  // dot 은 이름이 안 보이는 티어라 색이 유일한 단서다. 그 단서는 Role 이어야 한다.
  const dotColor = roleColor(person.role);

  return (
    <group>
      <PersonNode
        position={position}
        role={person.role}
        feature={person.feature}
        selected={selected}
        dimmed={dimmed}
      />
      <Html
        position={position as unknown as [number, number, number]}
        center
        zIndexRange={[30, 0]}
        style={{ pointerEvents: "auto", transition: "opacity 220ms ease", opacity }}
      >
        {/*
          명패는 LABEL_LIFT_PX 만큼 위로 떠 있어 노드 자체는 히트 타깃이
          없었다 — 화면에서 가장 크고 눈에 띄는 노드를 탭하면 아무것도 맞지
          않고 World.tsx 의 onPointerMissed 로 빠져 선택이 풀렸다. Html 이
          `center` 로 감싸는 wrapper 는 자기 자신의 bounding box 중심을 투영된
          지점에 맞춘다(drei Html.js) — 그 중심(50%, 50%)에 absolute 로 얹으면
          아래 라벨 div 의 크기와 무관하게 항상 노드의 실제 화면 위치에 온다.
          화면상 사람 간 최소 간격이 27.67px 이므로(layout.test.ts), 두 히트
          타깃이 서로 닿지 않으려면 지름이 그 절반(11.81px)보다 작아야 한다 —
          10px 로 여유를 남긴다. 시각적으로는 아무것도 바뀌지 않는다(투명,
          테두리 없음). 명패의 접근성 컨트롤과 중복되는 보조 히트존이라
          aria-hidden + tabIndex=-1 로 스크린리더·Tab 순서에서는 뺀다.
        */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onSelect(person.id)}
          className="absolute cursor-pointer bg-transparent border-0 p-0 rounded-full"
          style={{ left: "50%", top: "50%", width: 10, height: 10, transform: "translate(-50%, -50%)" }}
        />
        <div style={{ transform: `translateY(-${LABEL_LIFT_PX}px)` }}>
          {shown === "dot" ? (
            <button
              type="button"
              aria-label={person.name}
              onClick={() => onSelect(person.id)}
              className="grid place-items-center w-11 h-11 -m-[14px] cursor-pointer bg-transparent border-0"
            >
              <span
                className="block w-[7px] h-[7px] rounded-full"
                style={{
                  backgroundColor: dotColor,
                  opacity: selected ? 1 : 0.8,
                }}
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
        </div>
      </Html>
    </group>
  );
}
