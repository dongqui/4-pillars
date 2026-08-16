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
import {
  BESIDE_LAYERS,
  BESIDE_TILT,
  FIELD_CENTERS,
  FIELD_EXTENT,
  REFINE_GRID_STEP,
  REFINE_Y_COMPRESSION,
  SELF_POSITION,
  placePeople,
  positionFor,
} from "./layout";

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// BESIDE_LAYERS / BESIDE_TILT / REFINE_GRID_STEP / REFINE_Y_COMPRESSION 은
// _lib/layout.ts 에 정의된 단일 소스다. BesideLayers.tsx 와 RefineShards.tsx
// 도 이 값을 그대로 import 해서 렌더링에 쓴다 — 여기서 리터럴로 다시 베끼면
// layout.ts 를 layout.ts 자기 자신하고만 비교하는 테스트가 되어, 렌더링
// 컴포넌트가 이 값에서 벗어나도 아무것도 잡아내지 못한다.

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

describe("positionFor — Field 형태를 따른다", () => {
  it("beside: 사람이 BesideLayers.tsx 가 실제로 그리는 '기울어진' 평면 위에 있다", () => {
    // BesideLayers.tsx 는 평면들을 만든 뒤 group 전체를 Z축으로 BESIDE_TILT
    // 만큼 돌린다. 그러므로 '평면 위'라는 말은 기울어지기 전의 로컬 y 가
    // tier*extent 라는 뜻이다 — world 좌표를 center 만큼 빼고 -BESIDE_TILT
    // 만큼 역회전해서 그 로컬 프레임으로 되돌린 뒤 검사해야, 실제로 렌더되는
    // 평면과 맞는지가 증명된다. (world y 를 그대로 비교하면 회전을 빼먹은
    // 버그를 이 테스트가 놓친다 — 1차 수정에서 실제로 벌어졌던 일이다.)
    const center = FIELD_CENTERS.beside;
    const extent = FIELD_EXTENT.beside;
    const cos = Math.cos(-BESIDE_TILT);
    const sin = Math.sin(-BESIDE_TILT);
    for (let i = 0; i < 5; i++) {
      const [wx, wy] = positionFor("beside", i);
      const dx = wx - center[0];
      const dy = wy - center[1];
      // world 를 group 로컬 프레임으로 되돌리는 역회전(-BESIDE_TILT)
      const localY = dx * sin + dy * cos;
      const tier = BESIDE_LAYERS[i % BESIDE_LAYERS.length];
      expect(localY).toBeCloseTo(tier * extent, 10);
    }
  });

  it("move: 인덱스가 커질수록 흐름 방향(y)을 따라 단조 증가한다", () => {
    const ys = [0, 1, 2].map((i) => positionFor("move", i)[1]);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it("express: 인덱스가 커질수록 중심에서 더 멀어진다", () => {
    const center = FIELD_CENTERS.express;
    const distances = [0, 1, 2, 3].map((i) => dist(positionFor("express", i), center));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
  });

  it("refine: 정의된 두 격자 셀 위에, RefineShards.tsx 와 같은 step·y압축으로 놓인다", () => {
    const center = FIELD_CENTERS.refine;
    const extent = FIELD_EXTENT.refine;
    const step = extent * REFINE_GRID_STEP;
    const cells: Array<readonly [number, number, number]> = [
      [-1, 0, 1],
      [1, 0, -1],
    ];
    for (let i = 0; i < 2; i++) {
      const [x, y, z] = positionFor("refine", i);
      const c = cells[i % cells.length];
      expect(x - center[0]).toBeCloseTo(c[0] * step, 10);
      expect(y - center[1]).toBeCloseTo(c[1] * step * REFINE_Y_COMPRESSION, 10);
      expect(z - center[2]).toBeCloseTo(c[2] * step, 10);
    }
  });
});

describe("FIELD_CENTERS", () => {
  it("5개 역할이 모두 정의돼 있다", () => {
    for (const role of ROLE_ORDER) {
      expect(FIELD_CENTERS[role]).toBeDefined();
    }
  });

  it("Field 중심들이 서로 충분히 떨어져 있다", () => {
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = dist(FIELD_CENTERS[ROLE_ORDER[i]], FIELD_CENTERS[ROLE_ORDER[j]]);
        expect(d).toBeGreaterThan(3.5);
      }
    }
  });

  it("Field 중심이 원점에서 같은 거리에 있지 않다 — 동심원으로 보이면 실패다", () => {
    const radii = ROLE_ORDER.map((r) => dist(FIELD_CENTERS[r], [0, 0, 0]));
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

describe("진입 프레이밍 — 다 담지 않되 길을 잃지 않는다", () => {
  const eye = DEFAULT_CAMERA_POSITION as V3;
  const target = DEFAULT_TARGET as V3;

  const onScreen = (p: V3, from: V3 = eye, look: V3 = target) => {
    const n = projectToNdc(p, from, look, CAMERA_FOV, PHONE_ASPECT);
    return n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };

  it("나(원점)는 화면 안에 있다 — 기준점을 잃지 않는다", () => {
    expect(onScreen(SELF_POSITION as V3)).toBe(true);
  });

  it("Field 중심이 2~4개 보인다 — 빈 화면도, 전부 보이지도 않는다", () => {
    const visible = ROLE_ORDER.filter((r) => onScreen(FIELD_CENTERS[r] as V3)).length;
    expect(visible).toBeGreaterThanOrEqual(2);
    expect(visible).toBeLessThanOrEqual(4);
  });
});

describe("모든 Field 는 각 모드의 제한 안에서 도달 가능하다", () => {
  // '도달 가능' = Field 중심을 화면에 넣는 카메라 자세가 그 모드의
  // polar·azimuth·distance 범위 안에 하나 이상 있다. Field 전체가 프레임에
  // 들어올 필요는 없다. 못 가는 곳이 있으면 "길을 잃지 않는다"가 깨진다.
  const target = DEFAULT_TARGET as V3;

  const reachable = (center: V3, mode: CameraMode) => {
    const l = CAMERA_LIMITS[mode];
    const azMin = Number.isFinite(l.minAzimuth) ? l.minAzimuth : -Math.PI;
    const azMax = Number.isFinite(l.maxAzimuth) ? l.maxAzimuth : Math.PI;

    const STEPS = 24;
    for (let i = 0; i <= STEPS; i++) {
      const polar = l.minPolar + ((l.maxPolar - l.minPolar) * i) / STEPS;
      for (let j = 0; j <= STEPS; j++) {
        const az = azMin + ((azMax - azMin) * j) / STEPS;
        for (const d of [l.minDistance, (l.minDistance + l.maxDistance) / 2, l.maxDistance]) {
          const eye: V3 = [
            d * Math.sin(polar) * Math.sin(az),
            d * Math.cos(polar),
            d * Math.sin(polar) * Math.cos(az),
          ];
          const n = projectToNdc(center, eye, target, CAMERA_FOV, PHONE_ASPECT);
          if (n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1) return true;
        }
      }
    }
    return false;
  };

  for (const mode of ["a", "b", "c"] as CameraMode[]) {
    for (const role of ROLE_ORDER) {
      it(`${mode} 모드에서 ${role} 에 도달할 수 있다`, () => {
        expect(reachable(FIELD_CENTERS[role] as V3, mode)).toBe(true);
      });
    }
  }
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
