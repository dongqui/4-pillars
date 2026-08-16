"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hash01 } from "../_lib/layout";

function useSpherePositions(count: number, radius: number, seed: number) {
  return useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = seed + i * 3;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      const r = radius * (0.55 + hash01(s + 3) * 0.45);
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [count, radius, seed]);
}

function DustLayer({
  count,
  radius,
  size,
  opacity,
  drift,
  seed,
}: {
  count: number;
  radius: number;
  size: number;
  opacity: number;
  drift: number;
  seed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useSpherePositions(count, radius, seed);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * drift;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color="#cbd5e1"
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function Starfield() {
  return (
    <group>
      {/*
        멀수록 작고 흐리고 느리다.

        별먼지는 월드 내용물이 아니라 카메라를 감싸는 배경 껍질이다. 카메라를
        3.077 배 밀었으므로(camera.ts) 반지름과 입자 크기를 같은 배율로 키운다 —
        (카메라 거리, 껍질 반지름, 입자 크기)가 전부 같은 배율이면 투영 결과가
        픽셀 단위로 동일하다. 안 키우면 반지름 15·26 껍질이 통째로 카메라 앞으로
        나와, 시차(parallax)가 아니라 월드 한가운데 뜬 덩어리로 읽힌다.

        시드는 101 / 5003 / 9001 이다. 예전 101 / 523 / 947 은 s = seed + i*3 이라
        2·3번 레이어의 시드 구간(523..1780, 947..1424)이 1번(101..2798) 안에
        통째로 들어앉았다. hash01 이 순수 함수라 같은 s 는 같은 방향을 주므로,
        420개와 160개가 1번 레이어의 점들과 '완전히 같은 반직선' 위에 반지름
        비율만 다르게 놓였다 — 돌려봐야 강체 껍질이 통째로 도는 것처럼 보인다.
      */}
      <DustLayer count={900} radius={142} size={0.43} opacity={0.35} drift={0.004} seed={101} />
      <DustLayer count={420} radius={80} size={0.62} opacity={0.5} drift={0.011} seed={5003} />
      <DustLayer count={160} radius={46} size={0.86} opacity={0.65} drift={0.022} seed={9001} />

      {/* 황도면. 의식되지 않되 위/아래는 느껴지는 수준으로만. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 11, 96]} />
        <meshBasicMaterial
          color="#334155"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
