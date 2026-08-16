import { describe, it, expect } from "vitest";
import { FRIENDS, type MockPerson } from "../_data/mock-people";
import { ROLE_ORDER } from "../_data/roles";
import { NEBULA_CENTERS, placePeople, positionFor } from "./layout";

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("positionFor", () => {
  it("같은 역할·인덱스면 항상 같은 좌표를 준다", () => {
    expect(positionFor("fill", 3)).toEqual(positionFor("fill", 3));
  });

  it("같은 역할 안에서 인덱스가 다르면 좌표가 다르다", () => {
    expect(positionFor("fill", 0)).not.toEqual(positionFor("fill", 1));
  });
});

describe("placePeople", () => {
  // 브리프 9절: 六合=가까이 / 沖=멀리 를 만들지 않는다.
  it("feature 를 전부 바꿔도 좌표가 그대로다", () => {
    const before = placePeople(FRIENDS);

    const swapped: MockPerson[] = FRIENDS.map((p) => ({
      ...p,
      feature: p.feature === "yukhap" ? "chung" : "yukhap",
    }));
    const after = placePeople(swapped);

    for (const p of FRIENDS) {
      expect(after.get(p.id)).toEqual(before.get(p.id));
    }
  });

  it("20명 전원에게 좌표를 준다", () => {
    expect(placePeople(FRIENDS).size).toBe(20);
  });

  it("두 사람이 같은 자리에 겹치지 않는다", () => {
    const placed = [...placePeople(FRIENDS).values()];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(dist(placed[i], placed[j])).toBeGreaterThan(0.35);
      }
    }
  });
});

describe("NEBULA_CENTERS", () => {
  it("5개 역할이 모두 정의돼 있다", () => {
    for (const role of ROLE_ORDER) {
      expect(NEBULA_CENTERS[role]).toBeDefined();
    }
  });

  it("성운 중심들이 서로 충분히 떨어져 있다", () => {
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = dist(NEBULA_CENTERS[ROLE_ORDER[i]], NEBULA_CENTERS[ROLE_ORDER[j]]);
        expect(d).toBeGreaterThan(3.5);
      }
    }
  });

  it("성운 중심이 원점에서 같은 거리에 있지 않다 — 동심원으로 보이면 실패다", () => {
    const radii = ROLE_ORDER.map((r) => dist(NEBULA_CENTERS[r], [0, 0, 0]));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(1.5);
  });
});
