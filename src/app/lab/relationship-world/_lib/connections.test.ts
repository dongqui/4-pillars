import { describe, expect, it } from "vitest";
import { FRIENDS } from "../_data/mock-people";
import { ROLE_HUE, roleColor } from "../_data/role-colors";
import type { RelationRole } from "../_data/roles";
import {
  CONNECTION_OPACITY,
  CONNECTION_SELF_DIM,
  connectionColors,
  connectionSegments,
} from "./connections";
import { placePeople, SELF_POSITION, type Vec3 } from "./layout";

describe("connectionSegments", () => {
  const targets: Vec3[] = [
    [1, 2, 3],
    [-4, 0, 5],
  ];

  it("사람 한 명당 정점 두 개다", () => {
    expect(connectionSegments(targets)).toHaveLength(targets.length * 6);
  });

  it("모든 선분이 나에서 출발해 그 사람에서 끝난다", () => {
    const data = connectionSegments(targets);
    targets.forEach((t, i) => {
      expect([data[i * 6], data[i * 6 + 1], data[i * 6 + 2]]).toEqual([...SELF_POSITION]);
      expect([data[i * 6 + 3], data[i * 6 + 4], data[i * 6 + 5]]).toEqual([...t]);
    });
  });

  it("사람이 없으면 빈 배열이다 — 빈 지오메트리로 그려도 안전하다", () => {
    expect(connectionSegments([])).toHaveLength(0);
  });

  it("모든 사람에게 빠짐없이 선이 간다", () => {
    const placed = placePeople(FRIENDS);
    const data = connectionSegments(FRIENDS.map((p) => placed.get(p.id)!));
    expect(data).toHaveLength(FRIENDS.length * 6);
  });
});

describe("연결선 상수", () => {
  it("선택된 가닥(0.55)보다 훨씬 옅다", () => {
    // 20개가 동시에 떠 있는 기본 상태에서 선택한 하나가 가장 밝아야 한다.
    // 진입 카메라에서 20개 선분을 실제로 래스터화하면, 나의 opaque 코어
    // 바깥에서 최악의 겹침은 반지름 ≈10px 지점의 4겹이다(합성
    // 1-(1-0.14)^4 = 0.453) — 그래도 선택된 가닥을 넘지 않는다.
    expect(1 - Math.pow(1 - CONNECTION_OPACITY, 4)).toBeLessThan(0.55);
  });
});

function hexToUnit(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

// three 의 ColorManagement 가 쓰는 것과 같은 표준 sRGB→linear 조각별 전달
// 함수를 이 테스트 안에서 독립적으로 다시 적는다. connections.ts 의
// srgbToLinear 를 그대로 import 해서 비교하면 모듈이 자기 자신과만 일치하는지
// 확인하는 공허한 테스트가 된다 — 변환 자체가 틀려도 통과해버린다.
function srgbToLinearIndependent(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinear(hex: string): [number, number, number] {
  const [r, g, b] = hexToUnit(hex);
  return [srgbToLinearIndependent(r), srgbToLinearIndependent(g), srgbToLinearIndependent(b)];
}

describe("connectionColors", () => {
  const roles: RelationRole[] = ["fill", "beside", "refine"];

  it("사람 한 명당 정점 두 개의 RGB 를 만든다", () => {
    expect(connectionColors(roles)).toHaveLength(roles.length * 6);
  });

  it("사람 쪽 끝이 그 사람의 Role 색을 linear-sRGB 로 옮긴 값이다", () => {
    // three 0.185 는 ColorManagement.enabled 라 정점 색을 linear-sRGB 로
    // 읽는다. PersonNode 가 쓰는 THREE.Color(hex) 는 sRGB→linear 를 자동으로
    // 하므로, 여기서도 변환한 값이어야 선과 노드의 색이 실제로 일치한다.
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToLinear(roleColor(role));
      expect(data[i * 6 + 3]).toBeCloseTo(r, 5);
      expect(data[i * 6 + 4]).toBeCloseTo(g, 5);
      expect(data[i * 6 + 5]).toBeCloseTo(b, 5);
    });
  });

  it("나 쪽 끝은 linear 값을 같은 비율로 죽인다 — 중심에서 20개가 뭉치지 않게", () => {
    // 디밍은 광량 연산이라 linear 공간에서 걸려야 한다. sRGB 값에 먼저 곱하면
    // 표시 밝기가 CONNECTION_SELF_DIM(0.25) 이 아니라 감마 곡선 때문에
    // 훨씬 밝은 값(~0.53)으로 나온다 — 그 회귀를 이 테스트가 잡는다.
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToLinear(roleColor(role));
      expect(data[i * 6]).toBeCloseTo(r * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 1]).toBeCloseTo(g * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 2]).toBeCloseTo(b * CONNECTION_SELF_DIM, 5);

      // 나 쪽 끝이 정확히 사람 쪽 끝(이미 linear) 의 CONNECTION_SELF_DIM 배다.
      expect(data[i * 6]).toBeCloseTo(data[i * 6 + 3] * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 1]).toBeCloseTo(data[i * 6 + 4] * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 2]).toBeCloseTo(data[i * 6 + 5] * CONNECTION_SELF_DIM, 5);
    });
  });

  it("모든 역할이 서로 다른 선 색을 받는다", () => {
    const all = (Object.keys(ROLE_HUE) as RelationRole[]).map(roleColor);
    expect(new Set(all).size).toBe(all.length);
  });

  it("사람이 없으면 빈 배열이다", () => {
    expect(connectionColors([])).toHaveLength(0);
  });
});
