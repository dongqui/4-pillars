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
      const tiers = [-0.72, -0.24, 0.24, 0.72];
      const tier = tiers[indexInRole % tiers.length];
      local = [
        (hash01(s * 3 + 1) * 2 - 1) * extent * 1.15,
        tier * extent,
        (hash01(s * 3 + 2) * 2 - 1) * extent * 0.7,
      ];
      break;
    }
    case "express": {
      // 방사 광선: 코어에서 바깥으로, 거리를 서로 다르게
      const u = hash01(s * 3 + 1) * 2 - 1;
      const th = hash01(s * 3 + 2) * Math.PI * 2;
      const r = extent * (0.75 + (indexInRole / 4) * 1.1);
      const flat = Math.sqrt(1 - u * u);
      local = [r * flat * Math.cos(th), r * u * 0.6, r * flat * Math.sin(th)];
      break;
    }
    case "move": {
      // 흐르는 리본: 흐름 방향(y)을 따라 늘어세운다
      const t = (indexInRole + 0.5) / 3;
      local = [
        (hash01(s * 3 + 1) * 2 - 1) * extent * 1.0,
        (t - 0.5) * extent * 2.0,
        (hash01(s * 3 + 2) * 2 - 1) * extent * 1.0,
      ];
      break;
    }
    case "refine": {
      // 정돈된 결정: 격자 위에 올린다
      const cells: [number, number, number][] = [
        [-1, 0, 1],
        [1, 0, -1],
      ];
      const c = cells[indexInRole % cells.length];
      const step = extent * 0.85;
      local = [c[0] * step, c[1] * step * 0.8, c[2] * step];
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
