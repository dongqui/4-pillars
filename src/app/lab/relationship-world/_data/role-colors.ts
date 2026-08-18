import { hslToHex, type Hsl } from "./hsl";
import type { Feature, RelationRole } from "./roles";

/**
 * 노드 색은 그 사람의 사주가 아니라 **나와의 관계 Role** 이다.
 *
 * 이 방향은 직전 구현(색=사주)의 반대다. 그때는 색이 그룹에 대해 아무 정보도
 * 주지 못했고, 그룹을 알려주던 5개 Field 오브젝트는 그 앞 라운드에 삭제된
 * 뒤였다 — 사용자 입장에서 위치의 정보량이 0 이었다. 색을 Role 에 주는 것이
 * 그 공백을 메운다.
 *
 * 값은 배경 #0F172A 위에서 검산했다. 다섯 색이 화면에서 다섯으로 읽혀야 해서
 * 채도를 62~72 에서 **85 로 통일**하고 명도를 4 낮췄다. 세 상태(기본/六合/沖)를
 * 전부 펼쳐 15개 색을 재면 최저 대비가 4.87(식상 기본), hue 최소 간격은 54° 다.
 *
 * 채도 상한은 沖 이 정한다 — 沖 은 s+12 를 얹으므로 85 에서 97 이 되고 100 까지
 * 3 밖에 안 남는다. 여기서 더 올리면 沖 만 clamp 에 걸려 세 상태의 채도 간격이
 * 무너진다(六合 -10 / 기본 0 / 沖 +12 라는 대칭이 깨진다).
 * hue 를 옮길 때는 role-colors.test.ts 의 40° 하한을 반드시 통과시켜야 한다 —
 * 두 역할이 같은 색으로 읽히는 순간 이 설계의 전제가 무너진다.
 */
export const ROLE_HUE: Record<RelationRole, Hsl> = {
  fill: { h: 158, s: 85, l: 58 }, //    인성 · #39efac · 대비 12.00
  beside: { h: 212, s: 85, l: 60 }, //  비겁 · #4293f0 · 대비  5.66
  express: { h: 280, s: 85, l: 64 }, // 식상 · #bd55f1 · 대비  4.87
  move: { h: 35, s: 85, l: 58 }, //     재성 · #efa339 · 대비  8.47
  refine: { h: 340, s: 85, l: 61 }, //  관성 · #f0477f · 대비  5.03
};

/**
 * 기본 / 六合 / 沖 의 채도·명도 변조. **hue 는 건드리지 않는다.**
 *
 * 六合 은 맑아지고(채도↓ 명도↑), 沖 은 또렷해진다(채도↑ 명도 살짝↑).
 * 어느 쪽도 "더 세다"가 되면 안 된다 — 밝기의 균형은 색이 아니라
 * node-visual.ts 의 광량 불변식이 잡는다.
 */
const STATE_SHIFT: Record<Feature, { readonly s: number; readonly l: number }> = {
  none: { s: 0, l: 0 },
  yukhap: { s: -10, l: 12 },
  chung: { s: 12, l: 4 },
};

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** 상태 변조를 적용한 HSL. hue 는 언제나 ROLE_HUE[role].h 다. */
export function roleHsl(role: RelationRole, feature: Feature): Hsl {
  const base = ROLE_HUE[role];
  const shift = STATE_SHIFT[feature];
  return { h: base.h, s: clamp(base.s + shift.s), l: clamp(base.l + shift.l) };
}

/** 상태 변조 없는 Role 기본색. 연결선과 dot 명패가 쓴다. */
export function roleColor(role: RelationRole): string {
  return hslToHex(ROLE_HUE[role]);
}

/** 노드 코어 색. 상태까지 반영한다. */
export function nodeColor(role: RelationRole, feature: Feature): string {
  return hslToHex(roleHsl(role, feature));
}
