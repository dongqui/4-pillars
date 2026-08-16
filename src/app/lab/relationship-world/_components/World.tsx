"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ROLE_ORDER } from "../_data/roles";
import { FRIENDS } from "../_data/mock-people";
import { placePeople } from "../_lib/layout";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";
import { FieldRegistry } from "./fields/FieldRegistry";
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
        안개는 카메라 기준 깊이의 함수라 카메라 거리와 같은 3.077 배로 민다
        (18/52 → 55/160). 기본 진입에서 사람·성운의 깊이는 34.1~44.1 이라
        전부 near(55) 앞이다 — 판단해야 할 것이 안개에 묻히지 않는다.
        C 최대 줌아웃(100)에서만 36~46% 가 껴서 예전의 깊이감(22~51%)을 잇는다.
      */}
      <fog attach="fog" args={["#0F172A", 55, 160]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <CameraRig
        mode={mode}
        resetSignal={resetSignal}
        focusOn={selected ? placed.get(selected.id)! : null}
      />

      <Starfield />
      <SelfCore />

      {ROLE_ORDER.map((role) => (
        <FieldRegistry key={role} role={role} dimmed={selected !== null && selected.role !== role} />
      ))}

      {/*
        dim 은 '다른 성운'에만 건다. 같은 성운 사람까지 흐리면 boosted 로 한 단계
        올린 명패가 0.28 로 흐려진 채 커지기만 해서, 선택했을 때 오히려 더
        어지럽고 덜 읽힌다 — 설계 7절이 노린 것의 정반대다.
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
