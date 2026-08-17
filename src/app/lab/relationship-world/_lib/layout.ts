import type { RelationRole } from "../_data/roles";

export type Vec3 = readonly [number, number, number];

export const SELF_POSITION: Vec3 = [0, 0, 0];

// 의도적 비대칭이다. 원점에서의 거리·고도·방위각이 전부 다르다.
// fill(뒤)과 refine(앞)은 기본 시점에서 화면상 겹치도록 x,y 를 비슷하게 두고
// z 만 크게 벌렸다 — 겹침이 없으면 3D여도 평면 배치로 읽힌다.
export const FIELD_CENTERS: Record<RelationRole, Vec3> = {
  fill: [5.1, 1.8, -2.4],
  refine: [4.0, 0.6, 6.6],
  beside: [-6.3, -1.2, 1.8],
  move: [-3.6, 4.0, 3.6],
  express: [0.9, -3.0, 1.5],
};

// 인원이 많은 Field 일수록 넓게 퍼진다. 밀도도 함께 달라져 구분에 보탬이 된다.
export const FIELD_EXTENT: Record<RelationRole, number> = {
  fill: 3.2,
  beside: 2.3,
  express: 2.0,
  move: 1.7,
  refine: 1.4,
};

/** 시드 기반 0..1. Math.random 을 쓰면 렌더마다 월드가 흔들린다. */
export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
}

const ROLE_SEED: Record<RelationRole, number> = {
  fill: 17,
  beside: 53,
  express: 91,
  move: 137,
  refine: 211,
};

// ---------------------------------------------------------------------------
// Field 지오메트리 — 렌더링 컴포넌트와 positionFor 가 반드시 같은 값을 봐야
// 한다. 여기 한 곳에서만 정의하고 양쪽이 import 해서 쓴다. 값이 두 곳에 따로
// 있으면(리터럴 복붙) 한쪽만 고쳤을 때 사람이 도형에서 어긋나도 아무 테스트도
// 잡아내지 못한다 — 그게 이 상수들을 여기로 옮긴 이유다.
//
// 좌표는 전부 **Field 로컬 절대 좌표**다(이미 extent 가 곱해져 있다). 소비자가
// 다시 extent 를 곱하면 안 된다 — 한쪽만 곱하는 실수를 애초에 못 하게 하려고
// 이렇게 둔다.
//
// _components/ 는 이 모듈을 import 하지만 이 모듈은 _components/ 를 import
// 하지 않는다(순환 방지). layout.ts 는 vitest 가 environment:"node" 로
// 돌리므로 React/three/DOM import 를 들이면 안 된다 — 숫자만 놓는다.
// three 가 필요한 파생값(CatmullRom 곡선, 페이드 반지름)은
// _components/fields/geometry.ts 가 이 상수들로부터 만든다.

/** FillVolume.tsx 의 동심 셸 반지름 배율(× extent). */
export const FILL_SHELLS: readonly number[] = [1.0, 1.34, 1.72];

/** BesideLayers.tsx 의 LAYERS. 평행 층 4개의 로컬 y 위치(× extent). */
export const BESIDE_LAYERS: readonly number[] = [-0.72, -0.24, 0.24, 0.72];

/** BesideLayers.tsx 의 group rotation={[0, 0, BESIDE_TILT]}. Z축 기울기(rad). */
export const BESIDE_TILT = 0.16;

/** BesideLayers.tsx 의 planeGeometry 한 변(월드 단위). 짧은 변은 × ASPECT. */
export const BESIDE_PLANE_SPAN = FIELD_EXTENT.beside * 2.6;
export const BESIDE_PLANE_ASPECT = 0.62;

/** RefineShards.tsx 의 step = extent * REFINE_GRID_STEP. */
export const REFINE_GRID_STEP = 0.85;

/** RefineShards.tsx 의 y = ... * REFINE_Y_COMPRESSION. */
export const REFINE_Y_COMPRESSION = 0.8;

/** RefineShards.tsx 의 지터 폭(× extent). 격자 간격의 8% 이내. */
const REFINE_JITTER = 0.068;

export type Shard = {
  readonly pos: Vec3;
  readonly scale: number;
  readonly spin: number;
};

/**
 * RefineShards.tsx 가 그리는 26개 조각(3×3×3 에서 중심 제외).
 * positionFor("refine") 이 사람을 조각 **안에** 넣지 않으려면 같은 배열을 봐야
 * 한다 — 예전엔 컴포넌트에만 있어서 사람 둘이 조각 속에 파묻혀 있었다.
 */
export const REFINE_SHARDS: readonly Shard[] = (() => {
  const extent = FIELD_EXTENT.refine;
  const step = extent * REFINE_GRID_STEP;
  const j = extent * REFINE_JITTER;
  const out: Shard[] = [];
  let n = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        out.push({
          pos: [
            x * step + (hash01(n * 3 + 1) - 0.5) * j,
            y * step * REFINE_Y_COMPRESSION + (hash01(n * 3 + 2) - 0.5) * j,
            z * step + (hash01(n * 3 + 3) - 0.5) * j,
          ],
          scale: extent * (0.13 + hash01(n + 17) * 0.1),
          spin: 0.05 + hash01(n + 41) * 0.09,
        });
        n++;
      }
    }
  }
  return out;
})();

/** 가장 큰 조각의 반경. 사람이 조각 안에 들어갔는지 판정하는 기준이다. */
export const REFINE_MAX_SHARD_RADIUS = REFINE_SHARDS.reduce(
  (m, s) => Math.max(m, s.scale),
  0,
);

export const EXPRESS_RAY_COUNT = 9;
/** ExpressRays.tsx 의 planeGeometry 폭(월드 단위). 반폭은 이 값의 절반. */
export const EXPRESS_RAY_WIDTH = FIELD_EXTENT.express * 0.42;

export type Ray = { readonly dir: Vec3; readonly len: number; readonly phase: number };

/**
 * ExpressRays.tsx 가 그리는 9가닥의 방향·길이.
 * positionFor("express") 은 이 방향을 따라 사람을 놓는다 — 예전엔 방향을 따로
 * hash 해서 사람이 광선에서 최대 1.53 떨어져 허공에 떠 있었다.
 */
export const EXPRESS_RAYS: readonly Ray[] = Array.from(
  { length: EXPRESS_RAY_COUNT },
  (_, i) => {
    const extent = FIELD_EXTENT.express;
    const u = hash01(i * 3 + 11) * 2 - 1;
    const theta = hash01(i * 3 + 12) * Math.PI * 2;
    const flat = Math.sqrt(1 - u * u);
    return {
      dir: [flat * Math.cos(theta), u, flat * Math.sin(theta)] as Vec3,
      len: extent * (1.5 + hash01(i * 3 + 13) * 1.3),
      phase: hash01(i + 71) * 6.28,
    };
  },
);

export const MOVE_RIBBON_COUNT = 3;
/** MoveRibbons.tsx 의 TubeGeometry 반지름(월드 단위). */
export const MOVE_TUBE_RADIUS = FIELD_EXTENT.move * 0.055;

/**
 * MoveRibbons.tsx 의 CatmullRom 제어점 3가닥 × 6점.
 * Catmull-Rom 은 제어점을 **정확히 지나가므로**, 여기 있는 점 자체가 곧 곡선
 * 위의 점이다 — positionFor("move") 은 그래서 three 없이도 리본 위에 사람을
 * 놓을 수 있고, layout.test.ts 도 three 없이 그것을 증명할 수 있다.
 */
export const MOVE_RIBBONS: readonly (readonly Vec3[])[] = Array.from(
  { length: MOVE_RIBBON_COUNT },
  (_, i) => {
    const extent = FIELD_EXTENT.move;
    return Array.from({ length: 6 }, (_, k): Vec3 => {
      const s = i * 40 + k * 5;
      const t = k / 5;
      return [
        (hash01(s + 1) * 2 - 1) * extent * 1.5,
        (t - 0.5) * extent * 2.2 + (hash01(s + 2) - 0.5) * extent * 0.5,
        (hash01(s + 3) * 2 - 1) * extent * 1.5,
      ];
    });
  },
);

/** dir 에 수직인 단위벡터. seed 로 수직 평면 안의 각도를 돌린다. */
export function perpendicularTo(dir: Vec3, seed: number): Vec3 {
  const helper: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const ax = cross(dir, helper);
  const a = normalize(ax);
  const b = normalize(cross(dir, a));
  const ang = hash01(seed) * Math.PI * 2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * 사람 한 명의 좌표.
 *
 * feature 인자가 없다 — 궁합이 위치에 영향을 주는 코드는 작성 자체가 불가능하다.
 * (브리프 9절: 六合=가까이 / 沖=멀리 금지)
 */
export function positionFor(role: RelationRole, indexInRole: number): Vec3 {
  const center = FIELD_CENTERS[role];
  const extent = FIELD_EXTENT[role];
  const s = ROLE_SEED[role] + indexInRole * 7;

  // Field 의 형태를 따라 배치한다. 배치가 형태와 따로 놀면
  // 사람이 그 공간에 속해 보이지 않는다.
  let local: [number, number, number];

  switch (role) {
    case "fill": {
      // 감싸는 안개: 껍질 안쪽에 고루
      const u = hash01(s * 3 + 1) * 2 - 1;
      const th = hash01(s * 3 + 2) * Math.PI * 2;
      const r = extent * (0.4 + hash01(s * 3 + 3) * 0.75);
      const flat = Math.sqrt(1 - u * u);
      local = [r * flat * Math.cos(th), r * u * 0.75, r * flat * Math.sin(th)];
      break;
    }
    case "beside": {
      // 평행 층: 층 사이에 앉힌다. y 는 층 위치에 스냅한다.
      //
      // BesideLayers.tsx 는 네 평면을 만든 뒤 group 전체를 Z축으로
      // BESIDE_TILT 만큼 기울인다(<group rotation={[0,0,BESIDE_TILT]}>).
      // 여기서 (x, tier*extent) 를 회전 없이 그대로 center 에 더하면 평면의
      // '기울기 전' 로컬 좌표를 '기울어진 뒤' 월드 좌표인 것처럼 쓰는 셈이라,
      // 사람이 실제 평면에서 최대 0.22 만큼 어긋난다. 같은 Z축 회전을 여기서도
      // 적용해야 사람이 진짜 평면 위에 눕는다.
      const tier = BESIDE_LAYERS[indexInRole % BESIDE_LAYERS.length];
      const x = (hash01(s * 3 + 1) * 2 - 1) * extent * 1.15;
      const y = tier * extent;
      const z = (hash01(s * 3 + 2) * 2 - 1) * extent * 0.7;
      const cos = Math.cos(BESIDE_TILT);
      const sin = Math.sin(BESIDE_TILT);
      local = [x * cos - y * sin, x * sin + y * cos, z];
      break;
    }
    case "express": {
      // 방사 광선: 실제 광선 **방향 위**에, 코어에서 바깥으로.
      // 반지름만 고정하고 방향을 따로 hash 하면(예전 방식) 사람이 광선과
      // 무관한 허공에 놓인다 — 실제로 최대 1.53 만큼 벗어나 있었다.
      const r = extent * (0.75 + (indexInRole / 4) * 1.1);
      // 그 반지름이 길이 안에 들어오는 광선만 후보다. 끝을 넘으면 광선이
      // 이미 사라진 자리에 사람만 남는다. 시작 인덱스를 사람마다 벌려
      // 네 명이 서로 다른 방향으로 흩어지게 한다.
      let pick = indexInRole % EXPRESS_RAY_COUNT;
      for (let k = 0; k < EXPRESS_RAY_COUNT; k++) {
        const cand = (indexInRole * 2 + 1 + k) % EXPRESS_RAY_COUNT;
        if (EXPRESS_RAYS[cand].len >= r * 1.12) {
          pick = cand;
          break;
        }
      }
      const dir = EXPRESS_RAYS[pick].dir;
      // 축에서 살짝 비켜 놓는다(판 반폭 EXPRESS_RAY_WIDTH/2 안쪽).
      // 정확히 축 위에 두면 노드가 판과 완전히 같은 평면에 박힌다.
      const off = perpendicularTo(dir, s * 3 + 5);
      const lateral = extent * 0.09;
      local = [
        dir[0] * r + off[0] * lateral,
        dir[1] * r + off[1] * lateral,
        dir[2] * r + off[2] * lateral,
      ];
      break;
    }
    case "move": {
      // 흐르는 리본: 실제 제어점 위(= 곡선 위)에 놓는다.
      // Catmull-Rom 은 제어점을 정확히 통과하므로 제어점에서의 곡선까지
      // 거리는 0 이다. 예전엔 x/z 를 ±extent 로 무작위로 흩어서 가장 먼
      // 사람이 리본에서 1.09 떨어져 있었다(튜브 반지름 0.09).
      const ribbon = MOVE_RIBBONS[indexInRole % MOVE_RIBBON_COUNT];
      // 제어점 인덱스를 사람마다 하나씩 밀어 흐름 방향(y)으로 늘어세운다.
      const k = Math.min(1 + indexInRole, ribbon.length - 1);
      const p = ribbon[k];
      const nxt = ribbon[Math.min(k + 1, ribbon.length - 1)];
      const tangent = normalize([nxt[0] - p[0], nxt[1] - p[1], nxt[2] - p[2]]);
      // 튜브에 완전히 파묻히지 않게 흐름에 수직으로 조금 띄운다.
      const off = perpendicularTo(tangent, s * 3 + 5);
      const lateral = extent * 0.13;
      local = [
        p[0] + off[0] * lateral,
        p[1] + off[1] * lateral,
        p[2] + off[2] * lateral,
      ];
      break;
    }
    case "refine": {
      // 정돈된 결정: 격자의 **틈**(반칸 어긋난 체심 자리)에 올린다.
      // 예전의 [-1,0,1]·[1,0,-1] 은 26개 조각이 이미 차지한 칸이라 사람이
      // 팔면체 안에 통째로 갇혀 있었다(중심까지 0.030 / 0.041, 조각 반경
      // 0.285 / 0.246). 세 축을 전부 반칸씩 어긋내면 가장 가까운 조각까지
      // 0.91 이상이 확보되면서도 '격자 위'라는 읽힘은 그대로다.
      const cells: Vec3[] = [
        [-0.5, 0.5, 0.5],
        [0.5, -0.5, -0.5],
      ];
      const c = cells[indexInRole % cells.length];
      const step = extent * REFINE_GRID_STEP;
      local = [c[0] * step, c[1] * step * REFINE_Y_COMPRESSION, c[2] * step];
      break;
    }
  }

  return [center[0] + local[0], center[1] + local[1], center[2] + local[2]];
}

/** placePeople 이 볼 수 있는 전부. feature 는 여기 없다. */
export type Placeable = { readonly id: string; readonly role: RelationRole };

export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const seen = new Map<RelationRole, number>();
  const out = new Map<string, Vec3>();

  for (const person of people) {
    const index = seen.get(person.role) ?? 0;
    seen.set(person.role, index + 1);
    out.set(person.id, positionFor(person.role, index));
  }

  return out;
}
