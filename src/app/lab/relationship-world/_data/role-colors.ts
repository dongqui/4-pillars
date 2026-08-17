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
 * 값은 배경 #0F172A 위에서 검산했다. 대비 5.72~10.34, hue 최소 간격 54°.
 * hue 를 옮길 때는 role-colors.test.ts 의 40° 하한을 반드시 통과시켜야 한다 —
 * 두 역할이 같은 색으로 읽히는 순간 이 설계의 전제가 무너진다.
 */
export const ROLE_HUE: Record<RelationRole, Hsl> = {
  fill: { h: 158, s: 62, l: 62 }, //    인성 · #62daae · 대비 10.34
  beside: { h: 212, s: 68, l: 64 }, //  비겁 · #659fe2 · 대비  6.47
  express: { h: 280, s: 58, l: 68 }, // 식상 · #bd7edd · 대비  6.11
  move: { h: 35, s: 72, l: 62 }, //     재성 · #e4aa58 · 대비  8.66
  refine: { h: 340, s: 62, l: 65 }, //  관성 · #dd6e93 · 대비  5.72
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
