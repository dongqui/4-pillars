"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { FRIENDS } from "../_data/mock-people";
import { placePeople } from "../_lib/layout";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";
import { PersonMarker } from "./PersonMarker";
import { CameraRig } from "./CameraRig";
import { RelationThread } from "./RelationThread";
import { CAMERA_FOV, DEFAULT_CAMERA_POSITION, type CameraMode } from "../_lib/camera";

export function World({
  selectedId,
  onSelect,
  mode,
  resetSignal,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mode: CameraMode;
  resetSignal: number;
}) {
  const placed = useMemo(() => placePeople(FRIENDS), []);
  const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA_POSITION, fov: CAMERA_FOV }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#0F172A"]} />
      {/*
        안개는 카메라 기준 깊이의 함수라 카메라 거리와 같은 배율로 민다.
        55/160 은 DEFAULT_BASE_Z 가 40 이던 시절(×3.077)에 잡은 값이라, 26 으로
        내려온 지금은 C 최대 줌아웃(65)에서 3~13% 밖에 안 껴 대역이 사실상 죽어
        있었다. 같은 26/40 배율로 되돌린다(→ 35.8/104).
        기본 진입에서 사람·Field 중심의 깊이는 19.8~30.1 이라 전부 near(35.8)
        앞이다 — 판단해야 할 것이 안개에 묻히지 않는다. C 최대 줌아웃(65)에서
        깊이 57.9~68.1 이 32~47% 로 껴서 예전의 깊이감(22~51%)을 잇는다.
      */}
      <fog attach="fog" args={["#0F172A", 35.8, 104]} />

      <CameraRig
        mode={mode}
        resetSignal={resetSignal}
        focusOn={selected ? placed.get(selected.id)! : null}
      />

      <Starfield />
      <SelfCore />

      {/*
        dim 은 '다른 role 그룹'에만 건다. 같은 그룹 사람까지 흐리면 boosted 로 한
        단계 올린 명패가 흐려진 채 커지기만 해서, 선택했을 때 오히려 더 어지럽고
        덜 읽힌다.
      */}
      {FRIENDS.map((person) => (
        <PersonMarker
          key={person.id}
          person={person}
          position={placed.get(person.id)!}
          selected={selected?.id === person.id}
          dimmed={
            selected !== null && selected.id !== person.id && selected.role !== person.role
          }
          boosted={selected !== null && selected.role === person.role}
          onSelect={onSelect}
        />
      ))}

      {selected && (
        <RelationThread to={placed.get(selected.id)!} feature={selected.feature} />
      )}
    </Canvas>
  );
}
