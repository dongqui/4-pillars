"use client";

import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { roleColor } from "../_data/role-colors";
import {
  DISPLAY_TITLES,
  ROLE_ICON,
  ROLE_ORDER,
  type Feature,
  type RelationRole,
} from "../_data/roles";
import { badgeOffset } from "../_lib/badge-offset";
import { SELF_POSITION, subAnchor, type Vec3 } from "../_lib/layout";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];


/**
 * 15개 관계마다 "무슨 관계인지 · 몇 명인지"를 띄우는 배지.
 *
 * 색은 "다섯으로 갈렸다"까지만 말하고 "이 덩어리가 무엇인가"는 말하지 못한다.
 * Role 단위 배지 다섯 개로 시작했지만, 같은 색 안에서도 기본/六合/沖 은 서로
 * 다른 관계다 — 라이벌과 동지가 같은 파랑인데 이름이 하나뿐이면 그 구분이
 * 사라진다. 그래서 소구역마다 하나씩 붙인다.
 *
 * **사람이 없는 소구역에는 아무것도 그리지 않는다.** 목 데이터의 관성 沖 이
 * 그렇다. 빈 자리에 이름표만 떠 있으면 없는 관계가 있는 것처럼 읽힌다.
 */
export function RegionLabels({
  counts,
}: {
  counts: Record<RelationRole, Record<Feature, number>>;
}) {
  const shown = useMemo(
    () =>
      ROLE_ORDER.flatMap((role) =>
        FEATURES.filter((f) => counts[role][f] > 0).map((feature) => ({
          role,
          feature,
          at: subAnchor(role, feature),
        })),
      ),
    [counts],
  );

  return (
    <group>
      {shown.map(({ role, feature, at }) => (
        <Badge
          key={`${role}/${feature}`}
          role={role}
          feature={feature}
          at={at}
          count={counts[role][feature]}
        />
      ))}
    </group>
  );
}

function Badge({
  role,
  feature,
  at,
  count,
}: {
  role: RelationRole;
  feature: Feature;
  at: Vec3;
  count: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  // 매 프레임 새 객체를 만들지 않는다 — 배지가 14개다.
  const scratch = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  useFrame(() => {
    if (!box.current) return;
    // NDC → 화면 픽셀. y 는 NDC 가 위로 +, 화면은 아래로 + 다.
    const a = scratch.a.set(at[0], at[1], at[2]).project(camera);
    const b = scratch.b.set(SELF_POSITION[0], SELF_POSITION[1], SELF_POSITION[2]).project(camera);
    const toPx = (v: THREE.Vector3) => ({
      x: (v.x * 0.5 + 0.5) * size.width,
      y: (0.5 - v.y * 0.5) * size.height,
    });

    // 미는 계산 자체는 badge-offset.ts 의 순수 함수다 — useFrame 안에 두면
    // 브라우저 없이는 아무도 검증하지 못한다. 실제로 이 프로젝트의 미리보기
    // 창은 rAF 를 돌리지 않아 useFrame 이 아예 실행되지 않았고, 그래서 이
    // 오프셋이 적용되기 전 위치를 세 번 연속으로 재고 있었다.
    const off = badgeOffset(toPx(b), toPx(a));
    box.current.style.transform = `translate(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px)`;
  });

  return (
    <Html
      position={at as unknown as [number, number, number]}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        ref={box}
        className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] backdrop-blur-[2px] select-none"
        style={{
          borderColor: `${roleColor(role)}4d`,
          backgroundColor: "#0f172ad9",
          // 배지 글자는 그 구역 색 그대로다 — 노드와 같은 색이어야
          // "이 배지가 저 덩어리의 이름"이 설명 없이 읽힌다.
          color: roleColor(role),
        }}
      >
        <span className="text-[10px] leading-none" aria-hidden>
          {ROLE_ICON[role]}
        </span>
        <span className="text-[10px] font-semibold leading-none tracking-[0.02em]">
          {DISPLAY_TITLES[role][feature]}
        </span>
        <span className="text-[10px] font-bold leading-none tabular-nums opacity-80">
          {count}
        </span>
      </div>
    </Html>
  );
}
