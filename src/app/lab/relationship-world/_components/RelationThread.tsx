"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Feature } from "../_data/roles";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// 六合 과 沖 이 공유하는 단 하나의 색. 절대 분기시키지 않는다.
const THREAD_COLOR = "#94a3b8";
// 렌더링 결과 기준 불투명도. 겹치는 가닥 수로 역산해, 몇 가닥이 포개지든
// 합성 결과가 항상 이 값이 되게 한다 — 六合 과 沖 의 무게를 같게 유지하는 핵심.
// (알파값 자체는 feature 로 분기하지 않는다. strandAlpha 는 오직 "몇 가닥이
// 같은 자리에 겹치는가"라는 기하학적 사실에서만 값을 유도한다. 沖 이 두 가닥,
// 六合/none 이 한 가닥이라 인자가 다를 뿐, 관계 종류를 조건으로 쓰지 않는다.
// 이걸 다시 THREAD_OPACITY 하나로 "단순화"하면 沖 두 가닥이 겹쳐 그려질 때
// 합성 알파가 0.55 가 아니라 1-(1-0.55)^2 ≈ 0.80 이 되어 沖 이 六合보다
// 진하게 보이는 버그가 재발한다.)
const THREAD_OPACITY = 0.55;
function strandAlpha(strandCount: number) {
  return 1 - Math.pow(1 - THREAD_OPACITY, 1 / strandCount);
}
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

function Strand({
  curve,
  phase,
  alpha,
}: {
  curve: THREE.QuadraticBezierCurve3;
  phase: number;
  alpha: number;
}) {
  const base = useMemo(() => curve.getPoints(SEGMENTS), [curve]);

  // THREE.Line 은 R3F 에서 소문자 <line> 로 매핑되는데 JSX 내장 SVG line 과
  // 이름이 겹친다. 객체를 직접 만들어 <primitive> 로 넣으면 그 충돌이 없다.
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(base);
    const material = new THREE.LineBasicMaterial({
      color: THREAD_COLOR,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [base, alpha]);

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
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!ref.current) return;
    // 六合 전용: 입자가 곡선을 따라 느리고 끊김 없이 흐른다.
    const t = state.clock.elapsedTime * 0.14;
    const attr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      const u = (t + i / PARTICLES) % 1;
      const p = curve.getPoint(u, scratch);
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

// 곡선의 휘어짐 크기(bow)는 세 경로 모두 동일한 0.9 를 쓴다. 沖 의 교차는
// 부호만 반대일 뿐 크기가 커지면 안 된다 — 크기가 달라지면 沖 이 더 큰 호를
// 그리는 기하학적 차이가 생기고, 이는 feature 가 geometry/거리에 영향을
// 준다는 금지 규칙을 어기게 된다.
const BOW = 0.9;

export function RelationThread({ to, feature }: { to: Vec3; feature: Feature }) {
  const single = useMemo(() => buildCurve(to, BOW), [to]);
  // 沖 은 두 가닥이 서로 반대로 휘어 교차한다. 부호만 반대일 뿐 크기는 같다.
  const crossA = useMemo(() => buildCurve(to, BOW), [to]);
  const crossB = useMemo(() => buildCurve(to, -BOW), [to]);

  if (feature === "chung") {
    // 두 가닥이 같은 두 끝점(SELF_POSITION, to) 사이를 지나며 끝점 근처에서
    // 거의 겹친다. LineBasicMaterial 은 기본 NormalBlending 이라 알파가
    // 그대로 더해지므로, 가닥마다 THREAD_OPACITY 를 그대로 쓰면 겹치는
    // 지점에서 합성 알파가 1-(1-0.55)^2 ≈ 0.80 으로 六合의 단일 가닥(0.55)
    // 보다 진해진다 — 색은 같아도 "무게"가 달라 보이는 것도 금지 규칙 위반.
    // strandAlpha(2) 를 각 가닥에 써서 겹친 결과가 다시 THREAD_OPACITY 가
    // 되도록 역산한다.
    const alpha = strandAlpha(2);
    return (
      <group>
        <Strand curve={crossA} phase={0.4} alpha={alpha} />
        <Strand curve={crossB} phase={3.1} alpha={alpha} />
      </group>
    );
  }

  if (feature === "yukhap") {
    return (
      <group>
        <Strand curve={single} phase={0} alpha={strandAlpha(1)} />
        <FlowParticles curve={single} />
      </group>
    );
  }

  // feature 없음. 조용한 선 하나. 배지도 라벨도 붙지 않는다.
  return <Strand curve={single} phase={0} alpha={strandAlpha(1)} />;
}
