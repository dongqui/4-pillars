"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  CONNECTION_OPACITY,
  connectionColors,
  connectionSegments,
} from "../_lib/connections";
import type { Vec3 } from "../_lib/layout";
import type { RelationRole } from "../_data/roles";

/**
 * 나와 모든 사람을 잇는 기본 연결선. 규칙과 상수의 근거는 _lib/connections.ts 에.
 *
 * 노드 코어가 진입 화면에서 3.9~6.7px 로 작기 때문에, 다섯 갈래로 갈린 선이
 * 구역을 대신 말해준다. 20개를 각각 Line 객체로 만들면 드로우콜이 20개
 * 나지만 하나의 LineSegments 에 정점 색으로 넣으면 하나다.
 */
export function ConnectionLines({
  targets,
  roles,
}: {
  targets: readonly Vec3[];
  roles: readonly RelationRole[];
}) {
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(connectionSegments(targets), 3),
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(connectionColors(roles), 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: CONNECTION_OPACITY,
      // 선끼리 서로를 가리면 안 된다. 깊이 '테스트'는 켜둔 채라 사람의 opaque
      // 코어 뒤로 지나가는 구간은 제대로 가려진다 — 앞뒤 깊이감이 유지된다.
      depthWrite: false,
    });

    return new THREE.LineSegments(geometry, material);
  }, [targets, roles]);

  useEffect(() => {
    // <primitive> 는 자동 해제되지 않는다. RelationThread 와 같은 이유, 같은 처리.
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  return <primitive object={object} />;
}
