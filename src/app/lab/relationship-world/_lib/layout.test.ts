import { describe, it, expect } from "vitest";
import { FRIENDS } from "../_data/mock-people";
import { ROLE_ORDER, type Feature } from "../_data/roles";
import {
  CAMERA_FOV,
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  FOCUS_BIAS,
  FOCUS_DISTANCE,
  FRAME_LIFT,
  type CameraMode,
} from "./camera";
import {
  ANCHOR_RADIUS,
  ROLE_ANCHOR_LITERALS,
  ROLE_ANCHORS,
  SELF_POSITION,
  SPREAD,
  placePeople,
  positionFor,
  subAnchor,
} from "./layout";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

describe("Role 앵커", () => {
  it("5개 역할 전부에 앵커가 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_ANCHORS[role]).toBeDefined();
  });

  it("옮겨 적은 원본 좌표가 |v|=7 에서 크게 벗어나지 않는다 — 자릿수 오타를 잡는다", () => {
    // ROLE_ANCHORS[role].anchor 자체는 toAnchorRadius 를 거치므로 무엇을
    // 넣어도 길이가 정확히 7이 된다 — 그 값으로 "등거리"를 검사하면 리터럴이
    // 무엇이든 항상 통과하는 공허한 테스트가 된다(실제로 그랬다: junk 벡터로
    // 확인됨). 대신 정규화 전 원본 리터럴을 직접 재서, 값 하나를 통째로
    // 잘못 옮겨 적는 실수를 잡는다. 실측 최대 편차는 3.2e-5(refine) 다.
    for (const role of ROLE_ORDER) {
      expect(Math.abs(len(ROLE_ANCHOR_LITERALS[role]) - ANCHOR_RADIUS), role).toBeLessThan(1e-4);
    }
  });

  it("앵커끼리 충분히 떨어져 있다", () => {
    // 실측 최소 5.858. 하한 4 는 앵커를 옮길 여지를 남기면서 붕괴는 잡는 값이다.
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = dist(ROLE_ANCHORS[ROLE_ORDER[i]].anchor, ROLE_ANCHORS[ROLE_ORDER[j]].anchor);
        expect(d, `${ROLE_ORDER[i]}↔${ROLE_ORDER[j]}`).toBeGreaterThan(4);
      }
    }
  });

  it("기울임 축이 잘 정의된다 — 앵커가 y 축에 너무 가까우면 외적이 무너진다", () => {
    // subAnchor 는 dir × [0,1,0] 을 기울임 축으로 쓴다(|dir_y| > 0.9 면 [1,0,0]).
    // move 앵커의 dir_y 는 0.8996 으로 그 문턱 바로 아래다. 앵커를 조금만
    // 움직여도 분기가 뒤집히므로, 어느 분기를 타든 외적이 충분히 크다는 것을
    // 직접 잠근다.
    for (const role of ROLE_ORDER) {
      const a = ROLE_ANCHORS[role].anchor;
      const dir = [a[0] / ANCHOR_RADIUS, a[1] / ANCHOR_RADIUS, a[2] / ANCHOR_RADIUS];
      const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const c = [
        dir[1] * ref[2] - dir[2] * ref[1],
        dir[2] * ref[0] - dir[0] * ref[2],
        dir[0] * ref[1] - dir[1] * ref[0],
      ];
      expect(len(c), role).toBeGreaterThan(0.3);
    }
  });
});

describe("소구역", () => {
  it("모든 소구역이 나로부터 앵커와 같은 거리다 — 궁합이 거리를 바꿀 수 없다", () => {
    // 브리프 §2.2: 기본/六合/沖 을 나와의 거리로 구분하지 않는다.
    // 회전은 길이를 보존하므로 이것이 기하학적으로 성립한다. 예전에는
    // Placeable 타입이 배치가 feature 를 읽는 것 자체를 막았지만, 소구역이
    // feature 로 갈리는 지금은 그 방어가 불가능하다 — 이 테스트가 그 자리를 지킨다.
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(len(subAnchor(role, feature)), `${role}/${feature}`).toBeCloseTo(
          ANCHOR_RADIUS,
          9,
        );
      }
    }
  });

  it("한 역할의 세 소구역이 서로 등거리다 — 정삼각형이다", () => {
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f));
      const sides = [dist(a, b), dist(a, c), dist(b, c)];
      expect(Math.max(...sides) - Math.min(...sides), role).toBeLessThan(1e-9);
    }
  });

  it("세 소구역이 실제로 떨어져 있다 — 겹치면 소구역이 없는 것과 같다", () => {
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f));
      for (const d of [dist(a, b), dist(a, c), dist(b, c)]) {
        expect(d, role).toBeGreaterThan(2);
      }
    }
  });

  it("역할마다 소구역 방향이 다르다 — 다섯 삼각형이 같은 방향이면 기계적으로 보인다", () => {
    const phases = new Set(ROLE_ORDER.map((r) => ROLE_ANCHORS[r].phase));
    expect(phases.size).toBe(ROLE_ORDER.length);
  });
});

describe("positionFor", () => {
  it("같은 입력이면 항상 같은 좌표를 준다", () => {
    expect(positionFor("fill", "none", 3)).toEqual(positionFor("fill", "none", 3));
  });

  it("같은 소구역 안에서 인덱스가 다르면 좌표가 다르다", () => {
    expect(positionFor("fill", "none", 0)).not.toEqual(positionFor("fill", "none", 1));
  });

  it("사람이 자기 소구역의 퍼짐 반경 안에 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        for (let i = 0; i < 6; i++) {
          const d = dist(positionFor(role, feature, i), subAnchor(role, feature));
          expect(d, `${role}/${feature}/${i}`).toBeLessThanOrEqual(SPREAD[feature] + 1e-9);
        }
      }
    }
  });

  it("기본 소구역이 六合·沖 보다 넓게 퍼진다 — 비대칭이 문법이다", () => {
    // 기본은 느슨한 무리, 六合·沖 은 또렷한 자리다. 한 명뿐인 六合 자리가
    // 흩어진 무리의 낙오자로 보이면 안 된다.
    expect(SPREAD.none).toBeGreaterThan(SPREAD.yukhap);
    expect(SPREAD.yukhap).toBe(SPREAD.chung); // 六合 과 沖 은 언제나 같은 무게
  });
});

describe("placePeople", () => {
  it("20명 전원에게 좌표를 준다", () => {
    expect(placePeople(FRIENDS).size).toBe(20);
  });

  it("두 사람이 같은 자리에 겹치지 않는다", () => {
    // 나까지 포함한 21명의 실측 최소 3D 간격은 1.4023 (나윤 ↔ 건우, 둘 다
    // express/none) 이다 — positionFor 의 MIN_SEPARATION(1.4) 재시도가 이
    // 하한을 만든다. 하한 1.2 는 그보다 낮되 진짜 충돌(재시도가 실패해
    // MIN_SEPARATION 밑으로 되돌아가는 경우)은 잡는 값이다.
    const placed = [...placePeople(FRIENDS).values(), SELF_POSITION];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(dist(placed[i], placed[j])).toBeGreaterThan(1.2);
      }
    }
  });

  it("15칸 각각에 인원수만큼의 좌표가 생긴다 — 빈 칸에는 0개다", () => {
    // 관성 沖 은 목 데이터에서 비어 있다(15구역 중 유일한 0명 칸). 그 칸에
    // 유령 좌표가 생기지 않는 것이 "빈 소구역은 아무것도 그리지 않는다"의
    // 근거다.
    //
    // expected.filter(p => placed.has(p.id)).length 를 expected.length 와
    // 비교하는 방식은 빈 칸에서 늘 expected = [] 라 공허하게 참이 되어
    // 아무것도 증명하지 못한다 — 유령 좌표가 있든 없든 통과한다. 대신
    // placePeople 의 출력 크기와 key 집합을 입력 전체와 통째로 비교한다:
    // 유령 좌표가 하나라도 생기면 size 가 늘거나 key 집합에 없는 id 가 섞인다.
    const placed = placePeople(FRIENDS);
    expect(placed.size).toBe(FRIENDS.length);
    expect(new Set(placed.keys())).toEqual(new Set(FRIENDS.map((p) => p.id)));

    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const expected = FRIENDS.filter((p) => p.role === role && p.feature === feature);
        // 그 칸의 좌표들은 전부 그 칸의 중심 주변에 있어야 한다 — 인덱스가
        // 엇갈리면 사람이 남의 소구역에 놓인다.
        for (const p of expected) {
          expect(dist(placed.get(p.id)!, subAnchor(role, feature)), p.id).toBeLessThanOrEqual(
            SPREAD[feature] + 1e-9,
          );
        }
      }
    }
    expect(FRIENDS.filter((p) => p.role === "refine" && p.feature === "chung")).toHaveLength(0);
  });

  it("한 사람을 빼도 같은 소구역의 나머지 좌표가 움직이지 않는다", () => {
    // indexInSubRegion 은 (role, feature) 쌍 안에서 센다. Role 안 전체 순번으로
    // 세면 한 명이 빠졌을 때 같은 소구역 사람들이 전부 자리를 옮긴다.
    const before = placePeople(FRIENDS);
    const dropped = FRIENDS.find((p) => p.role === "fill" && p.feature === "yukhap")!;
    const after = placePeople(FRIENDS.filter((p) => p.id !== dropped.id));
    for (const p of FRIENDS) {
      if (p.id === dropped.id) continue;
      if (p.role !== "fill") continue;
      expect(after.get(p.id), p.id).toEqual(before.get(p.id));
    }
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

describe("진입 프레이밍 — 다섯 구역이 전부 보인다", () => {
  const eye = DEFAULT_CAMERA_POSITION as V3;
  const target = DEFAULT_TARGET as V3;
  const onScreen = (p: V3) => {
    const n = projectToNdc(p, eye, target, CAMERA_FOV, PHONE_ASPECT);
    return n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };

  it("나(원점)는 화면 안에 있다", () => {
    expect(onScreen(SELF_POSITION as V3)).toBe(true);
  });

  it("5개 앵커가 전부 화면 안에 있다", () => {
    // 직전 구현은 2~4개만 보였고, 비겁 5명이 통째로 화면 밖이었다. 그것이
    // "위치가 아무 정보도 주지 않는다"에 크게 기여했다.
    for (const role of ROLE_ORDER) {
      expect(onScreen(ROLE_ANCHORS[role].anchor as V3), role).toBe(true);
    }
  });

  it("20명 전원이 화면 안에 투영된다", () => {
    for (const [id, p] of placePeople(FRIENDS)) {
      expect(onScreen(p as V3), id).toBe(true);
    }
  });

  it("앵커들의 깊이가 서로 다르다 — 같은 깊이면 평면 배치로 읽힌다", () => {
    const depths = ROLE_ORDER.map(
      (r) => projectToNdc(ROLE_ANCHORS[r].anchor as V3, eye, target, CAMERA_FOV, PHONE_ASPECT).depth,
    );
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(8);
  });

  // 3D 상 떨어져 있어도 화면에서 겹치면 사용자에게는 겹친 것이다. 무작위
  // 탐색이 앵커끼리 19px 까지 붙는 해를 냈던 것이 바로 이 함정이다 —
  // 3D 거리만 재는 테스트는 그걸 통과시킨다.
  const screen = (p: V3) => {
    const n = projectToNdc(p, eye, target, CAMERA_FOV, PHONE_ASPECT);
    return { x: (n.x * 0.5 + 0.5) * 375, y: (0.5 - n.y * 0.5) * 812 };
  };
  const screenDist = (a: V3, b: V3) => {
    const [p, q] = [screen(a), screen(b)];
    return Math.hypot(p.x - q.x, p.y - q.y);
  };

  it("앵커 간 화면 거리가 100px 이상이다", () => {
    // 실측 최소 123px.
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = screenDist(
          ROLE_ANCHORS[ROLE_ORDER[i]].anchor as V3,
          ROLE_ANCHORS[ROLE_ORDER[j]].anchor as V3,
        );
        expect(d, `${ROLE_ORDER[i]}↔${ROLE_ORDER[j]}`).toBeGreaterThan(100);
      }
    }
  });

  it("한 역할의 소구역 셋이 화면에서 40px 이상 벌어진다", () => {
    // 실측 최소 48px(재성). 근접 halo 지름보다 커야 세 자리로 읽힌다.
    // phase 는 이 값이 최대가 되도록 역할마다 고른 것이라, 앵커를 옮기면
    // 여기가 먼저 깨진다.
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f) as V3);
      for (const d of [screenDist(a, b), screenDist(a, c), screenDist(b, c)]) {
        expect(d, role).toBeGreaterThan(40);
      }
    }
  });

  it("사람 간 화면 거리가 18px 이상이다 — 이름표가 겹치지 않는다", () => {
    // 앵커(100px)·소구역(40px) 은 지키는데 사람과 사람은 지키지 않던 문턱이다.
    // 실측: positionFor 에 MIN_SEPARATION 재시도가 없던 때는 도윤↔가온
    // (둘 다 beside/none)이 5.09px 로 붙어, 그 깊이(≈20.9)에서 CORE_RADIUS
    // (0.075)가 만드는 반지름 3.13px 를 두 배 넘게 삼켰다 — 이름표가 겹쳐
    // 누가 누군지 읽을 수 없었다. 3D 최소 간격(그때 0.2579)은 통과했다 —
    // 앵커에서 겪은 "3D 로는 떨어져 있어도 화면에서는 겹친다"가 사람 단위에서
    // 그대로 재현된 것이다.
    // 지금 실측 최소는 23.62px(지현 ↔ 태호, 둘 다 fill/none, 깊이 ≈22.5) 다.
    const placed = [...placePeople(FRIENDS).values(), SELF_POSITION].map((p) => p as V3);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(screenDist(placed[i], placed[j])).toBeGreaterThan(18);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 포커스 뷰 프레이밍 잠금
//
// 위의 "진입 프레이밍" 은 오직 기본 뷰(아무도 선택하지 않은 상태)만 잠갔다.
// CameraRig.tsx 의 FOCUS_DISTANCE·FOCUS_BIAS·FRAME_LIFT 는 사람을 선택했을
// 때의 뷰를 겨냥하는데, 그 뷰에는 지금까지 테스트가 없었다 — 세 상수의
// 주석이 인용하던 실측치가 15구역 재설계로 layout.ts 좌표가 통째로 바뀌는
// 동안에도 조용히 틀려질 수 있었던 것이 바로 그 공백 때문이다. 이 테스트가
// 그 공백을 메운다.
//
// CameraRig 의 useFrame 은 애니메이션 내내 "방향(dir)은 불변, target 과
// distance 만 보간한다"는 불변식을 지킨다(CameraRig.tsx 주석 참고) — 그래서
// 최종 정착 상태는 useFrame 루프를 흉내 내지 않고도 닫힌 형태로 계산된다:
// dir 은 진입 카메라의 방향 그대로이고, eye = desiredTarget + dir·distance 다.

describe("focus view — 사람을 선택했을 때 20명 전원이 화면 안에 있다", () => {
  const initialDir = norm3(sub(DEFAULT_CAMERA_POSITION as V3, DEFAULT_TARGET as V3));
  const placed = placePeople(FRIENDS);

  for (const mode of ["a", "b", "c"] as CameraMode[]) {
    it(`${mode} 모드`, () => {
      const limits = CAMERA_LIMITS[mode];
      const distance = Math.min(Math.max(FOCUS_DISTANCE, limits.minDistance), limits.maxDistance);

      for (const person of FRIENDS) {
        const focusOn = placed.get(person.id)! as V3;
        const mid: V3 = [
          SELF_POSITION[0] + (focusOn[0] - SELF_POSITION[0]) * FOCUS_BIAS,
          SELF_POSITION[1] + (focusOn[1] - SELF_POSITION[1]) * FOCUS_BIAS,
          SELF_POSITION[2] + (focusOn[2] - SELF_POSITION[2]) * FOCUS_BIAS,
        ];
        const desiredTarget: V3 = [mid[0], mid[1] - FRAME_LIFT, mid[2]];
        const eye: V3 = [
          desiredTarget[0] + initialDir[0] * distance,
          desiredTarget[1] + initialDir[1] * distance,
          desiredTarget[2] + initialDir[2] * distance,
        ];

        const n = projectToNdc(focusOn, eye, desiredTarget, CAMERA_FOV, PHONE_ASPECT);
        expect(
          n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1,
          `${mode} 모드에서 ${person.id} 를 포커스`,
        ).toBe(true);
      }
    });
  }
});

describe("모든 Role 구역은 각 모드의 제한 안에서 도달 가능하다", () => {
  // '도달 가능' = Role 앵커를 화면에 넣는 카메라 자세가 그 모드의
  // polar·azimuth·distance 범위 안에 하나 이상 있다. 구역 전체가 프레임에
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
        expect(reachable(ROLE_ANCHORS[role].anchor as V3, mode)).toBe(true);
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
