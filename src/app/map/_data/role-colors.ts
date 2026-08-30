import { hslToHex, type Hsl } from "./hsl";
import type { Feature, RelationRole } from "./roles";

/**
 * 지도의 배경색. World 의 <color>·<fog>, connections.ts 의 배경 lerp,
 * roleTextColor 의 대비 계산이 전부 이 값을 본다 — 여기서 갈라지면 "배경
 * 쪽으로 물러난다"는 연산들이 서로 다른 배경을 향해 물러난다.
 */
export const MAP_BACKGROUND = "#F8FAFC";

/**
 * 노드 색은 그 사람의 사주가 아니라 **나와의 관계 Role** 이다.
 *
 * 이 방향은 직전 구현(색=사주)의 반대다. 그때는 색이 그룹에 대해 아무 정보도
 * 주지 못했고, 그룹을 알려주던 5개 Field 오브젝트는 그 앞 라운드에 삭제된
 * 뒤였다 — 사용자 입장에서 위치의 정보량이 0 이었다. 색을 Role 에 주는 것이
 * 그 공백을 메운다.
 *
 * 값은 라이트 리디자인 시안(Saju Relationship Map.dc.html)의 확정 팔레트를
 * HSL 로 옮긴 것이다. 소수점은 시안 hex 를 채널당 ±2/255 안에서 복원하기 위한
 * 값이라 임의로 반올림하지 말 것 — role-colors.test.ts 가 hex 복원을 잠근다.
 *
 * 다크 시절의 "배경 대비 4.5" 규칙은 이 표가 아니라 roleTextColor 가 진다:
 * 그래픽(노드·선·점·아바타)은 시안 hex 그대로, 색 텍스트만 어둡게 내린다.
 * hue 최소 간격은 38.5°(초록↔하늘)다 — 예전 하한 40° 를 38 로 내렸다. 시안
 * hex 유지가 우선이고, 이 두 색은 명도(39 vs 48)로도 갈린다.
 */
export const ROLE_HUE: Record<RelationRole, Hsl> = {
  fill: { h: 160.1, s: 84.1, l: 39.4 }, //    인성 · #10B981
  beside: { h: 37.7, s: 92.1, l: 50.2 }, //   비겁 · #F59E0B
  express: { h: 258.3, s: 89.6, l: 66.3 }, // 식상 · #8B5CF6
  move: { h: 341.0, s: 71.4, l: 50.6 }, //    재성 · #DB2760
  refine: { h: 198.6, s: 88.7, l: 48.4 }, //  관성 · #0EA5E9
};

/**
 * 기본 / 六合 / 沖 의 채도·명도 변조. **hue 는 건드리지 않는다.**
 *
 * 六合 은 맑아지고(채도↓ 명도↑), 沖 은 또렷해진다(채도↑ 명도 살짝↑).
 * 어느 쪽도 "더 세다"가 되면 안 된다 — 밝기의 균형은 색이 아니라
 * node-visual.ts 의 광량 불변식이 잡는다.
 *
 * 시안 팔레트에서 沖 의 s+12 는 beside(92.1)·refine(88.7)에서 100 클램프에
 * 걸린다 — 다크 시절처럼 세 상태의 채도 간격이 대칭으로 남지는 않지만,
 * l+4 가 함께 걸려 세 상태의 구분 자체는 유지된다(role-colors.test.ts 의
 * "세 상태가 서로 다른 색").
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

/** WCAG 상대 휘도. roleTextColor 의 대비 탐색에 쓴다. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastOnBackground(hex: string): number {
  const a = relativeLuminance(hex);
  const b = relativeLuminance(MAP_BACKGROUND);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * 색 텍스트(목록의 구역명·별명 태그, 3D 구역 라벨)용 어두운 변형.
 *
 * hue·채도는 그대로 두고 명도만 1씩 내려, MAP_BACKGROUND 대비 4.5:1 을 처음
 * 넘는 값을 쓴다. 그래픽 색과 갈라 두는 이유: #F59E0B 같은 시안 색은 흰 배경
 * 텍스트로는 1.9:1 이라 읽을 수 없는데, 노드·점까지 어둡게 내리면 시안
 * 팔레트가 아니게 된다. 5개뿐이라 모듈 로드 때 전부 만들어 둔다.
 */
const TEXT_COLOR = Object.fromEntries(
  (Object.keys(ROLE_HUE) as RelationRole[]).map((role) => {
    const base = ROLE_HUE[role];
    let l = base.l;
    let hex = hslToHex({ h: base.h, s: base.s, l });
    while (l > 1 && contrastOnBackground(hex) < 4.5) {
      l -= 1;
      hex = hslToHex({ h: base.h, s: base.s, l });
    }
    return [role, hex];
  }),
) as Record<RelationRole, string>;

export function roleTextColor(role: RelationRole): string {
  return TEXT_COLOR[role];
}
