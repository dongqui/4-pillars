"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  CONNECTION_DIMMED_OPACITY,
  CONNECTION_OPACITY,
  CONNECTION_SELECTED_OPACITY,
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
 *
 * 사람을 고르면 **없던 마크를 만들지 않고 이 선을 강조한다.** 예전에는 고른
 * 사람에게 새 곡선이 따로 떴는데, 그러면 그 관계만 특별한 통로가 있는 것처럼
 * 읽혔다. 있던 선이 밝아지고 나머지가 물러나면 구조는 그대로인 채 초점만 옮는다.
 */
export function ConnectionLines({
  targets,
  roles,
  selectedIndex,
}: {
  targets: readonly Vec3[];
  roles: readonly RelationRole[];
  /** targets/roles 안의 위치. 아무도 고르지 않았으면 null. */
  selectedIndex: number | null;
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

  // 알파는 재질 유니폼 하나라 정점 색처럼 선마다 다르게 줄 수 없다. 그래서
  // 선택이 바뀔 때 지오메트리를 다시 만들지 않고 이 값만 갈아 끼운다 —
  // 위 useMemo 의 의존성에 selectedIndex 를 넣으면 사람을 고를 때마다
  // 20개 정점 버퍼가 통째로 재생성된다.
  useEffect(() => {
    const material = object.material as THREE.LineBasicMaterial;
    material.opacity =
      selectedIndex === null ? CONNECTION_OPACITY : CONNECTION_DIMMED_OPACITY;
  }, [object, selectedIndex]);

  useEffect(() => {
    // <primitive> 는 자동 해제되지 않는다. 직접 버린다.
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  const selected =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < targets.length
      ? { target: targets[selectedIndex], role: roles[selectedIndex] }
      : null;

  return (
    <>
      <primitive object={object} />
      {selected && <SelectedConnection target={selected.target} role={selected.role} />}
    </>
  );
}

/**
 * 고른 사람의 선 하나를, 같은 두 점 위에 같은 색으로 한 번 더 그린다.
 *
 * 아래 깔린 dim 된 선과 정확히 겹치므로 그 지점의 합성은
 * 1-(1-0.07)(1-0.55) = 0.581 이다 — 의도한 0.55 보다 5% 진하다. 이 정도는
 * 그냥 둔다. 겹침을 없애려면 기본 지오메트리에서 그 한 선분을 빼야 하는데,
 * 그러면 선택할 때마다 정점 버퍼를 다시 만들게 되어 값이 훨씬 비싸다.
 * 깊이 쓰기가 꺼져 있어 같은 자리에 두 번 그려도 z-fighting 은 없다.
 */
function SelectedConnection({ target, role }: { target: Vec3; role: RelationRole }) {
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(connectionSegments([target]), 3),
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(connectionColors([role]), 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: CONNECTION_SELECTED_OPACITY,
      depthWrite: false,
    });

    return new THREE.LineSegments(geometry, material);
  }, [target, role]);

  useEffect(() => {
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  return <primitive object={object} />;
}
