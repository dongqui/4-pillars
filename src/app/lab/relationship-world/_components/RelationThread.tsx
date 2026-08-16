"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Feature } from "../_data/roles";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// 六合 과 沖 이 공유하는 단 하나의 색. 절대 분기시키지 않는다.
const THREAD_COLOR = "#94a3b8";

/**
 * 화면에 찍히는 선 하나의 불투명도. 저작(authored)된 상수는 이것 하나다.
 *
 * 六合 과 沖 은 같은 색, 같은 밝기여야 한다 — 한쪽이 진하면 그 순간 좋은 관계 /
 * 나쁜 관계로 읽힌다. 그래서 세 경로(沖 두 가닥, 六合 한 가닥, 없음 한 가닥)의
 * <Strand> 는 전부 이 값을 그대로 쓴다.
 *
 * 예전에는 沖 의 두 가닥이 서로 겹친다고 보고 두 가닥 모두 strandAlpha(2)=0.329
 * 를 썼는데, 실측하면 두 가닥은 겹치지 않는다. 포커스 뷰 375px 에서 가닥 사이
 * 간격의 중앙값이 34~74px 이고, 2px 안으로 붙는 구간은 곡선 길이의 0.5~1.5%
 * (양 끝점의 짧은 꼬리뿐이고 그마저 명패에 가린다). 결과적으로 沖 은 사실상
 * 어디서나 0.329, 六合 은 0.55 로 그려져 前提가 만들려던 것과 정반대로
 * 기울어 있었다.
 */
const THREAD_OPACITY = 0.55;

/**
 * 같은 자리에 n 개의 마크가 실제로 포개질 때, 합성 결과가 THREAD_OPACITY 가
 * 되도록 각 마크에 줄 알파. 유도의 근거는 오직 "정말 겹치는가"라는 기하학적
 * 사실이지 feature 가 아니다.
 *
 * 지금 이 조건을 만족하는 곳은 한 군데뿐이다 — 六合 의 흐름 입자. 입자는
 * 정의상 곡선 위(curve.getPoint)에 놓이므로 자기 아래의 선과 반드시 겹친다.
 * 입자에도 THREAD_OPACITY 를 주면 그 지점의 합성이 1-(1-0.55)^2 ≈ 0.80 이 되어
 * 六合 쪽만 무거워진다.
 */
function strandAlpha(markCount: number) {
  return 1 - Math.pow(1 - THREAD_OPACITY, 1 / markCount);
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
    // 버퍼를 0 으로 만들어 두므로 최초 바운딩 스피어가 원점 반경 0 으로 잡힌다.
    // 지금 안 잘리는 건 R3F 의 Update 단계가 Render 보다 먼저 도는 덕이지
    // 보장이 아니다. 컬링을 끄면 프레임 순서에 기대지 않는다 (입자 16개다).
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color={THREAD_COLOR}
        transparent
        // 입자는 자기 아래의 선과 진짜로 겹치는 유일한 마크다 → 역산 알파.
        opacity={strandAlpha(2)}
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
    // 두 가닥은 부호가 반대인 호라 서로 겹치지 않는다 — 375px 포커스 뷰에서
    // 간격 중앙값 34~74px, 2px 안으로 붙는 구간은 길이의 0.5~1.5% 뿐이고
    // 그것도 명패 아래 숨는 끝점 꼬리다. 겹치지 않으니 역산할 것도 없다.
    // 두 가닥 모두 六合·없음과 똑같은 THREAD_OPACITY 로 그린다.
    return (
      <group>
        <Strand curve={crossA} phase={0.4} alpha={THREAD_OPACITY} />
        <Strand curve={crossB} phase={3.1} alpha={THREAD_OPACITY} />
      </group>
    );
  }

  if (feature === "yukhap") {
    return (
      <group>
        <Strand curve={single} phase={0} alpha={THREAD_OPACITY} />
        <FlowParticles curve={single} />
      </group>
    );
  }

  // feature 없음. 조용한 선 하나. 배지도 라벨도 붙지 않는다.
  return <Strand curve={single} phase={0} alpha={THREAD_OPACITY} />;
}
