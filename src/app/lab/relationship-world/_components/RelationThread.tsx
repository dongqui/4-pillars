"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Feature } from "../_data/roles";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// 六合 과 沖 이 공유하는 단 하나의 색. 절대 분기시키지 않는다.
const THREAD_COLOR = "#94a3b8";
const THREAD_OPACITY = 0.55;
const SEGMENTS = 64;
const PARTICLES = 16;

function buildCurve(to: Vec3, bow: number) {
  const a = new THREE.Vector3(...SELF_POSITION);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  // 직선이면 그래프의 엣지로 읽힌다. 살짝 휘어야 흐름이 된다.
  const normal = new THREE.Vector3(0, 1, 0).cross(b.clone().sub(a)).normalize();
  mid.add(normal.multiplyScalar(bow)).add(new THREE.Vector3(0, bow * 0.35, 0));
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function Strand({ curve, phase }: { curve: THREE.QuadraticBezierCurve3; phase: number }) {
  const base = useMemo(() => curve.getPoints(SEGMENTS), [curve]);

  // THREE.Line 은 R3F 에서 소문자 <line> 로 매핑되는데 JSX 내장 SVG line 과
  // 이름이 겹친다. 객체를 직접 만들어 <primitive> 로 넣으면 그 충돌이 없다.
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(base);
    const material = new THREE.LineBasicMaterial({
      color: THREAD_COLOR,
      transparent: true,
      opacity: THREAD_OPACITY,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [base]);

  useEffect(() => {
    // <primitive> 는 자동 해제되지 않는다. 선택을 바꿀 때마다 새 객체가 생기므로 직접 버린다.
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  useFrame((state) => {
    if (phase === 0) return;
    // 沖 전용: 가닥이 팽팽하게 떤다. 진폭은 작게 — 크면 고장으로 보인다.
    const t = state.clock.elapsedTime;
    const attr = object.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = base[i];
      const w = Math.sin((i / SEGMENTS) * Math.PI); // 양 끝은 고정
      const j = Math.sin(t * 9 + i * 0.55 + phase) * 0.045 * w;
      attr.setXYZ(i, p.x + j, p.y + j * 0.6, p.z - j);
    }
    attr.needsUpdate = true;
  });

  return <primitive object={object} />;
}

function FlowParticles({ curve }: { curve: THREE.QuadraticBezierCurve3 }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);

  useFrame((state) => {
    if (!ref.current) return;
    // 六合 전용: 입자가 곡선을 따라 느리고 끊김 없이 흐른다.
    const t = state.clock.elapsedTime * 0.14;
    const attr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      const u = (t + i / PARTICLES) % 1;
      const p = curve.getPoint(u);
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color={THREAD_COLOR}
        transparent
        opacity={THREAD_OPACITY}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function RelationThread({ to, feature }: { to: Vec3; feature: Feature }) {
  const single = useMemo(() => buildCurve(to, 0.9), [to]);
  // 沖 은 두 가닥이 서로 반대로 휘어 교차한다.
  const crossA = useMemo(() => buildCurve(to, 1.15), [to]);
  const crossB = useMemo(() => buildCurve(to, -1.15), [to]);

  if (feature === "chung") {
    return (
      <group>
        <Strand curve={crossA} phase={0.4} />
        <Strand curve={crossB} phase={3.1} />
      </group>
    );
  }

  if (feature === "yukhap") {
    return (
      <group>
        <Strand curve={single} phase={0} />
        <FlowParticles curve={single} />
      </group>
    );
  }

  // feature 없음. 조용한 선 하나. 배지도 라벨도 붙지 않는다.
  return <Strand curve={single} phase={0} />;
}
