"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ROLE_ORDER } from "../_data/roles";
import { FRIENDS } from "../_data/mock-people";
import { placePeople } from "../_lib/layout";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";
import { Nebula } from "./Nebula";
import { PersonMarker } from "./PersonMarker";
import { CameraRig } from "./CameraRig";
import type { CameraMode } from "../_lib/camera";

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
      camera={{ position: [0, 3.2, 13], fov: 50 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#0F172A"]} />
      <fog attach="fog" args={["#0F172A", 18, 52]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <CameraRig mode={mode} resetSignal={resetSignal} />

      <Starfield />
      <SelfCore />

      {ROLE_ORDER.map((role) => (
        <Nebula key={role} role={role} dimmed={selected !== null && selected.role !== role} />
      ))}

      {FRIENDS.map((person) => (
        <PersonMarker
          key={person.id}
          person={person}
          position={placed.get(person.id)!}
          selected={selected?.id === person.id}
          dimmed={selected !== null && selected.id !== person.id}
          boosted={selected !== null && selected.role === person.role}
          onSelect={onSelect}
        />
      ))}
    </Canvas>
  );
}
