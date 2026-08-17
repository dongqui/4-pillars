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
    // 최악의 겹침(3겹)까지 쌓여도 선택된 가닥을 넘지 않는 값이어야 한다.
    expect(1 - Math.pow(1 - CONNECTION_OPACITY, 3)).toBeLessThan(0.55);
  });
});

function hexToUnit(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

describe("connectionColors", () => {
  const roles: RelationRole[] = ["fill", "beside", "refine"];

  it("사람 한 명당 정점 두 개의 RGB 를 만든다", () => {
    expect(connectionColors(roles)).toHaveLength(roles.length * 6);
  });

  it("사람 쪽 끝이 그 사람의 Role 색이다", () => {
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToUnit(roleColor(role));
      expect(data[i * 6 + 3]).toBeCloseTo(r, 5);
      expect(data[i * 6 + 4]).toBeCloseTo(g, 5);
      expect(data[i * 6 + 5]).toBeCloseTo(b, 5);
    });
  });

  it("나 쪽 끝은 같은 색을 같은 비율로 죽인다 — 중심에서 20개가 뭉치지 않게", () => {
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToUnit(roleColor(role));
      expect(data[i * 6]).toBeCloseTo(r * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 1]).toBeCloseTo(g * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 2]).toBeCloseTo(b * CONNECTION_SELF_DIM, 5);
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
