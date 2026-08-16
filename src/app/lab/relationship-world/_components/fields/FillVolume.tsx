"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { MistMaterial } from "./shaders/materials";

const SHELLS = [1.0, 1.34, 1.72];

export function FillVolume({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof MistMaterial> | null>>([]);
  const center = FIELD_CENTERS.fill;
  const extent = FIELD_EXTENT.fill;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      // 아주 느린 호흡. 인지되면 안 되고 살아 있다는 느낌만 남긴다.
      group.current.scale.setScalar(1 + Math.sin(t * 0.32) * 0.025);
    }
    const target = dimmed ? 0.14 : 0.5;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = t;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {SHELLS.map((s, i) => (
        <mesh key={s}>
          <icosahedronGeometry args={[extent * s, 3]} />
          <mistMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.fill)}
            uOpacity={0.5}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
