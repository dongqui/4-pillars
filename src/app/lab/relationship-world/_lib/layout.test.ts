import { describe, it, expect } from "vitest";
import { FRIENDS, type MockPerson } from "../_data/mock-people";
import { ROLE_ORDER } from "../_data/roles";
import {
  CAMERA_FOV,
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  type CameraMode,
} from "./camera";
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

// ---------------------------------------------------------------------------
// 375×812 프레이밍 잠금
//
// 이 스파이크는 오직 폰에서 판단된다. three 의 fov 는 '수직'이라 세로 화면에서
// 가로 화각이 aspect 만큼 좁아지고(375/812 → 가로 반각 12.2°), 가로로 넓게 퍼진
// 월드는 통째로 화면 밖으로 밀려난다. 예전 상수(거리 13.39)에서는 20명 중 4명,
// 성운 5개 중 1개만 화면에 들어왔다. 데스크톱에서는 20/20 이라 눈으로는 안 잡힌다.
//
// three 를 import 하지 않는다 — 씬 그래프도 WebGL 도 필요 없는 순수 행렬 산수다.
// 아래는 THREE.PerspectiveCamera(lookAt + projectionMatrix)와 같은 식이다.

type V3 = readonly [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: V3): V3 => {
  const l = Math.sqrt(dot3(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** 원근 투영 후의 NDC. |x|<=1 이고 |y|<=1 이면 화면 안이다. */
function projectToNdc(point: V3, eye: V3, target: V3, fovDeg: number, aspect: number) {
  const forward = norm3(sub(target, eye)); // 카메라의 −z
  const right = norm3(cross3(forward, [0, 1, 0]));
  const up = norm3(cross3(right, forward));

  const rel = sub(point, eye);
  const depth = dot3(rel, forward); // 뷰공간 −z. 양수여야 카메라 앞이다.
  const t = Math.tan((fovDeg * Math.PI) / 360);

  return { x: dot3(rel, right) / (aspect * t * depth), y: dot3(rel, up) / (t * depth), depth };
}

const PHONE_ASPECT = 375 / 812;

describe("기본 진입 뷰 프레이밍 (375×812)", () => {
  const eye = DEFAULT_CAMERA_POSITION as V3;
  const target = DEFAULT_TARGET as V3;
  const placed = placePeople(FRIENDS);

  const onScreen = (p: V3) => {
    const n = projectToNdc(p, eye, target, CAMERA_FOV, PHONE_ASPECT);
    return n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };

  it("사람 20명 중 18명 이상이 화면 안에 들어온다", () => {
    const visible = FRIENDS.filter((p) => onScreen(placed.get(p.id)! as V3)).length;
    expect(visible).toBeGreaterThanOrEqual(18);
  });

  it("성운 중심 5개가 전부 화면 안에 들어온다", () => {
    for (const role of ROLE_ORDER) {
      expect(onScreen(NEBULA_CENTERS[role] as V3)).toBe(true);
    }
  });
});

describe("기본 진입 뷰는 A·B·C 세 모드의 제한 안에 있다", () => {
  // 같은 자리에서 출발하지 않으면 세 모드를 비교할 수 없다 (설계 10절).
  const offset = sub(DEFAULT_CAMERA_POSITION as V3, DEFAULT_TARGET as V3);
  const distance = Math.sqrt(dot3(offset, offset));
  const polar = Math.acos(offset[1] / distance);
  const azimuth = Math.atan2(offset[0], offset[2]);

  for (const mode of ["a", "b", "c"] as CameraMode[]) {
    it(`${mode} 모드`, () => {
      const l = CAMERA_LIMITS[mode];
      expect(distance).toBeGreaterThanOrEqual(l.minDistance);
      expect(distance).toBeLessThanOrEqual(l.maxDistance);
      expect(polar).toBeGreaterThanOrEqual(l.minPolar);
      expect(polar).toBeLessThanOrEqual(l.maxPolar);
      expect(azimuth).toBeGreaterThanOrEqual(l.minAzimuth);
      expect(azimuth).toBeLessThanOrEqual(l.maxAzimuth);
    });
  }
});
