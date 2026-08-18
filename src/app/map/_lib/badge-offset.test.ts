import { describe, expect, it } from "vitest";
import { FRIENDS } from "../_data/mock-people";
import { DISPLAY_TITLES, ROLE_ORDER, type Feature } from "../_data/roles";
import { BADGE_DOWN_BIAS_PX, BADGE_PUSH_PX, badgeOffset } from "./badge-offset";
import { CAMERA_FOV, DEFAULT_CAMERA_POSITION, DEFAULT_TARGET } from "./camera";
import { SELF_POSITION, placePeople, subAnchor } from "./layout";

type V3 = readonly [number, number, number];
const FEATURES: Feature[] = ["none", "yukhap", "chung"];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

// 진입 화면 투영. three 없이 THREE.PerspectiveCamera 와 같은 식이다.
const W = 375;
const H = 812;
const CAM = DEFAULT_CAMERA_POSITION as V3;
const tan = Math.tan((CAMERA_FOV * Math.PI) / 360);
const fwd = norm(sub(DEFAULT_TARGET as V3, CAM));
const right = norm(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);
const project = (p: V3) => {
  const v = sub(p, CAM);
  const d = dot(v, fwd);
  return {
    x: ((dot(v, right) / d / (tan * (W / H))) * 0.5 + 0.5) * W,
    y: (0.5 - (dot(v, up) / d / tan) * 0.5) * H,
  };
};

// 브라우저에서 실측한 박스 크기(375×812, 기본 진입).
const BADGE_H = 18;
const badgeWidth = (title: string) =>
  title.length <= 2 ? 64 : title.length === 3 ? 73 : title.length === 4 ? 82 : 91;
const LABEL_W = 37;
const LABEL_H = 32;
const LABEL_LIFT = 32; // PersonMarker 의 LABEL_LIFT_PX

type Box = { l: number; t: number; r: number; b: number; k: string };
const overlaps = (a: Box, b: Box) => !(a.r < b.l || b.r < a.l || a.b < b.t || b.b < a.t);

function badgeBoxes(): Box[] {
  const self = project(SELF_POSITION as V3);
  return ROLE_ORDER.flatMap((role) =>
    FEATURES.filter((f) => FRIENDS.some((p) => p.role === role && p.feature === f)).map((f) => {
      const at = project(subAnchor(role, f) as V3);
      const off = badgeOffset(self, at);
      const cx = at.x + off.x;
      const cy = at.y + off.y;
      const w = badgeWidth(DISPLAY_TITLES[role][f]);
      return {
        l: cx - w / 2,
        r: cx + w / 2,
        t: cy - BADGE_H / 2,
        b: cy + BADGE_H / 2,
        k: DISPLAY_TITLES[role][f],
      };
    }),
  );
}

function labelBoxes(): Box[] {
  const placed = placePeople(FRIENDS);
  return FRIENDS.map((p) => {
    const s = project(placed.get(p.id)! as V3);
    return {
      l: s.x - LABEL_W / 2,
      r: s.x + LABEL_W / 2,
      t: s.y - LABEL_LIFT - LABEL_H / 2,
      b: s.y - LABEL_LIFT + LABEL_H / 2,
      k: p.name,
    };
  });
}

describe("badgeOffset", () => {
  it("나에서 배지 쪽으로 미는 크기가 일정하다", () => {
    // 방향만 바뀌고 크기는 같아야 한다 — 어떤 구역은 더 멀리 밀리면
    // 그 구역이 더 중요해 보인다.
    for (const [ax, ay] of [
      [10, 0],
      [0, -10],
      [-7, 7],
    ]) {
      const off = badgeOffset({ x: 0, y: 0 }, { x: ax, y: ay });
      expect(Math.hypot(off.x, off.y - BADGE_DOWN_BIAS_PX)).toBeCloseTo(BADGE_PUSH_PX, 9);
    }
  });

  it("나와 배지가 화면에서 같은 점이면 아래로만 민다", () => {
    const off = badgeOffset({ x: 100, y: 100 }, { x: 100, y: 100 });
    expect(off.x).toBe(0);
    expect(off.y).toBe(BADGE_PUSH_PX + BADGE_DOWN_BIAS_PX);
  });
});

describe("진입 화면에서의 배지 배치", () => {
  it("14개가 뜬다 — 사람이 없는 소구역은 빠진다", () => {
    // 15칸 중 관성 沖 이 0명이다.
    expect(badgeBoxes()).toHaveLength(14);
  });

  it("배지끼리 겹치지 않는다", () => {
    const boxes = badgeBoxes();
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (overlaps(boxes[i], boxes[j])) hits.push(`${boxes[i].k}↔${boxes[j].k}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("배지가 화면 밖으로 나가지 않는다", () => {
    const out = badgeBoxes().filter((b) => b.l < 0 || b.r > W || b.t < 0 || b.b > H);
    expect(out.map((b) => b.k)).toEqual([]);
  });

  it("명패와의 겹침이 실측치를 넘지 않는다", () => {
    // 375px 에 배지 14개와 명패 20개는 겹침 없이 들어가지 않는다. push 를
    // 키우면 명패 겹침은 줄지만(76 에서 4쌍) 배지가 화면 밖으로 나간다(2개).
    // 34/24 가 그 둘을 합친 최적점이고 그때 7쌍이 남는다. 이 수가 늘면
    // 배치나 상수가 나빠진 것이다 — 줄이려면 화면 위 글자 수 자체를 줄여야 한다.
    const badges = badgeBoxes();
    const labels = labelBoxes();
    let hits = 0;
    for (const b of badges) for (const l of labels) if (overlaps(b, l)) hits++;
    expect(hits).toBeLessThanOrEqual(7);
  });
});
