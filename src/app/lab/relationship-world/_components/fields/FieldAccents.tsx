"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RelationRole } from "../../_data/roles";
import { ROLE_ORDER } from "../../_data/roles";
import {
  BESIDE_LAYERS,
  BESIDE_PLANE_ASPECT,
  BESIDE_PLANE_SPAN,
  BESIDE_TILT,
  EXPRESS_RAYS,
  EXPRESS_RAY_WIDTH,
  FIELD_CENTERS,
  FIELD_EXTENT,
  FILL_SHELLS,
  hash01,
  perpendicularTo,
} from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { FIELD_FADE_RADIUS, MOVE_ACCENT_SPREAD, MOVE_CURVES } from "./geometry";

// ---------------------------------------------------------------------------
// 악센트는 "경계와 분위기만 암시"하는 보조 요소다(설계 4절). 그러려면 **그
// Field 의 형태를 따라야** 한다. 예전엔 다섯 개 전부 0.82~1.15 extent 짜리
// 같은 구면 껍질에 뿌렸는데, 그건 이 브랜치가 없애려던 "알고리즘 하나에 숫자만
// 다른" 마지막 컴포넌트였고 실제 지오메트리와도 맞지 않았다:
//
//   refine  격자 한가운데에 랜덤 점 140개 — 설계 3절이 격자의 존재 이유로 든
//           "랜덤 배치로는 이 대비가 생기지 않는다"를 정면으로 부순다
//   beside  평면 정체성이 '납작함'인데 ±Y 로 1 월드 단위씩 부풀었다
//   express 광선은 2.55 extent 까지 뻗는데 악센트는 1.15 에서 끝나 본체 속에 묻힘
//   move    리본은 2.04 extent 인데 마찬가지로 안쪽 공에 갇힘
//   fill    안개 셸은 1.00/1.34/1.72 인데 악센트는 가장 안쪽 셸만 따라감
//
// 그래서 역할마다 다른 전략을 쓴다. refine 만 개수가 0 인데, 이유는 아래 참고.
const ACCENT_COUNT: Record<RelationRole, number> = {
  fill: 140,
  beside: 140,
  express: 135, // 9가닥 × 15
  move: 120, // 3가닥 × 40
  // 격자 사이에 점을 흩는 순간 refine 의 유일한 정체성인 '정돈됨'이 깨진다.
  // 이 Field 의 경계는 각진 조각 26개가 이미 또렷하게 그리고 있어서 암시가
  // 필요 없다 — 다섯 중 하나만 악센트가 없는 것이 설계 3절에 맞는 답이다.
  refine: 0,
};

function buildAccents(role: RelationRole): Float32Array {
  const count = ACCENT_COUNT[role];
  const arr = new Float32Array(count * 3);
  const extent = FIELD_EXTENT[role];
  // role.length 는 fill/move(4)·beside/refine(6) 이 충돌해 시드가 아니었다.
  // ROLE_ORDER 상 위치는 다섯 role 모두에 대해 값이 다르다.
  const seed = (ROLE_ORDER.indexOf(role) + 1) * 137;

  for (let i = 0; i < count; i++) {
    const s = seed + i * 3;
    let p: [number, number, number];

    switch (role) {
      case "fill": {
        // 가장 바깥 안개 셸 위. 안개의 경계는 그 셸이지 안쪽 셸이 아니다.
        const outer = Math.max(...FILL_SHELLS);
        const u = hash01(s + 1) * 2 - 1;
        const th = hash01(s + 2) * Math.PI * 2;
        const r = extent * (outer - 0.1 + hash01(s + 3) * 0.1);
        const flat = Math.sqrt(1 - u * u);
        p = [r * flat * Math.cos(th), r * u, r * flat * Math.sin(th)];
        break;
      }
      case "beside": {
        // 평행 판 더미를 따라. 판 밖으로 부풀지 않는다 — '납작함'이 정체성이다.
        const tier = BESIDE_LAYERS[i % BESIDE_LAYERS.length];
        const th = hash01(s + 1) * Math.PI * 2;
        const rr = Math.sqrt(0.3 + hash01(s + 2) * 0.7); // 타원판 위 고른 분포
        const x = Math.cos(th) * rr * (BESIDE_PLANE_SPAN / 2);
        const z = Math.sin(th) * rr * ((BESIDE_PLANE_SPAN * BESIDE_PLANE_ASPECT) / 2);
        const y = tier * extent + (hash01(s + 3) - 0.5) * extent * 0.1;
        // BesideLayers 는 group 전체를 Z축으로 BESIDE_TILT 돌린다. 같은 회전을
        // 여기서도 걸어야 점이 실제로 그 판 위에 눕는다(positionFor 와 동일).
        const c = Math.cos(BESIDE_TILT);
        const sn = Math.sin(BESIDE_TILT);
        p = [x * c - y * sn, x * sn + y * c, z];
        break;
      }
      case "express": {
        // 각 광선 방향을 따라. 광선이 실제로 뻗는 곳에서만 빛나야 한다.
        const ray = EXPRESS_RAYS[i % EXPRESS_RAYS.length];
        const t = 0.12 + hash01(s + 1) * 0.88;
        const off = perpendicularTo(ray.dir, s + 2);
        const lateral = hash01(s + 3) * (EXPRESS_RAY_WIDTH / 2);
        p = [
          ray.dir[0] * ray.len * t + off[0] * lateral,
          ray.dir[1] * ray.len * t + off[1] * lateral,
          ray.dir[2] * ray.len * t + off[2] * lateral,
        ];
        break;
      }
      case "move": {
        // 리본 곡선을 따라. 흐름이 지나가는 자리에만 잔상이 남는다.
        const curve = MOVE_CURVES[i % MOVE_CURVES.length];
        const on = curve.getPoint(hash01(s + 1));
        const tangent = curve.getTangent(hash01(s + 1));
        const off = perpendicularTo([tangent.x, tangent.y, tangent.z], s + 2);
        const spread = hash01(s + 3) * MOVE_ACCENT_SPREAD;
        p = [on.x + off[0] * spread, on.y + off[1] * spread, on.z + off[2] * spread];
        break;
      }
      case "refine":
        p = [0, 0, 0]; // count 가 0 이라 도달하지 않는다
        break;
    }

    arr[i * 3] = p[0];
    arr[i * 3 + 1] = p[1];
    arr[i * 3 + 2] = p[2];
  }

  return arr;
}

export function FieldAccents({ role, dimmed }: { role: RelationRole; dimmed: boolean }) {
  const mat = useRef<THREE.PointsMaterial>(null);
  const center = FIELD_CENTERS[role];
  const positions = useMemo(() => buildAccents(role), [role]);
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  useFrame((state, delta) => {
    if (!mat.current) return;
    // 본체와 **같은** 근접 페이드를 건다. 이게 없어서, 카메라가 Field 안으로
    // 들어가 본체가 0 으로 죽은 뒤에도 이 점 140개만 0.34 로 남아 이 브랜치가
    // 없애려던 흰 파티클 구름이 그대로 보였다. PointsMaterial 은 평범한 JS
    // 재질이라 셰이더를 건드릴 필요 없이 여기서 곱하면 된다.
    const r = FIELD_FADE_RADIUS[role];
    const camDist = state.camera.position.distanceTo(centerVec);
    const t = THREE.MathUtils.clamp((camDist - r * 0.65) / (r * 1.15 - r * 0.65), 0, 1);
    const proximity = t * t * (3 - 2 * t); // GLSL smoothstep 과 같은 식
    const target = (dimmed ? 0.08 : 0.34) * proximity;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, delta * 5);
  });

  if (ACCENT_COUNT[role] === 0) return null;

  return (
    <points position={center as unknown as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.09}
        color={FIELD_TINT[role]}
        transparent
        opacity={0.34}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
