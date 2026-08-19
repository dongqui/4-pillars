"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { STATE_RADIUS } from "../_lib/layout";
import type { Feature } from "../_data/roles";

/**
 * 세 껍질을 나타내는 얇은 원. 나를 중심으로 XZ 평면에 눕는다.
 *
 * 왜 필요한가: 원근 투영에서 "원점으로부터의 거리"는 눈으로 읽기 어렵다.
 * 멀리 있는 것은 작게 보이지만 화면 위 어디에 있는지는 방향이 정한다 —
 * 껍질을 2.5 씩 벌려도 어느 사람이 어느 껍질인지는 여전히 애매하다.
 * 원이 있으면 각 노드가 어느 원 근처인지로 즉시 읽힌다.
 *
 * 이건 예전에 지운 '황도면 disc' 와 다르다. 그건 방향감을 주려던 반투명 면
 * 하나였고 이것은 세 껍질의 반지름을 그대로 그린 선이다. 그래도 화면에 뭔가가
 * 늘어나는 것은 사실이라, 지우려면 이 컴포넌트 하나를 World 에서 빼면 된다.
 *
 * 사람 노드는 XZ 평면 위에만 있지 않으므로 원이 노드를 정확히 관통하지는
 * 않는다. 원이 말하는 것은 "이 반지름"이지 "이 자리"가 아니다.
 */
const SEGMENTS = 128;
const RING_ORDER: Feature[] = ["yukhap", "none", "chung"];

export function ShellRings() {
  const object = useMemo(() => {
    const group = new THREE.Group();

    for (const feature of RING_ORDER) {
      const radius = STATE_RADIUS[feature];
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: "#94a3b8",
        transparent: true,
        // 연결선(0.14)보다도 옅다. 읽히는 순간 배경이 아니라 내용이 된다.
        opacity: 0.09,
        depthWrite: false,
      });
      group.add(new THREE.Line(geometry, material));
    }

    return group;
  }, []);

  return <primitive object={object} />;
}
