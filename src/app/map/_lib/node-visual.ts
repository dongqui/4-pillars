/**
 * 사람 Node 의 시각 상수와 halo 텍스처 데이터.
 *
 * three 를 import 하지 않는다. 텍스처 '데이터'만 순수 함수로 만들고, 실제
 * THREE.DataTexture 조립은 PersonNode.tsx 가 한다 — 그래야 이 규칙들이 node
 * 환경 테스트로 잠긴다.
 *
 * 이 값들은 서로 독립이 아니다 — STATE_VISUAL.nearAlpha 는 각 상태의
 * nearRadius/diffuseAlpha 와 DIFFUSE_HALO_RADIUS 로부터 stateLight() 가
 * 세 상태에서 같아지도록 역산한 값이라, 반지름이나 확산 알파를 하나만
 * 만져도 nearAlpha 를 전부 다시 풀어야 한다. 실물을 보고 조절할 값은
 * DIFFUSE_HALO_RADIUS 하나뿐이었던 이전 버전과 달리, 지금은 계산으로
 * 검증되지 않은 값이 STATE_VISUAL 전체로 퍼져 있다.
 */

import type { Feature } from "../_data/roles";

/** 코어. 사람의 위치 그 자체. opaque 로 그려서 깊이 버퍼에 참여한다. */
export const CORE_RADIUS = 0.075;

/**
 * 나만 노드가 크다. 코어와 근접 halo 에 함께 걸린다.
 * 진입 화면(375px, 1 월드 단위 ≈ 32.5px)에서 코어 지름 19.5px, 근접 halo 72.8px.
 */
export const SELF_NODE_SCALE = 4;

/**
 * 확산 halo 반지름. **세 상태가 같은 값을 쓴다.**
 *
 * 상태마다 바꾸면 六合 의 빛 번짐이 승인된 폭을 넘는다 — 초안의 2.1 은 진입
 * 화면 지름 166px 로, 승인된 104px 의 160% 였다. 상태 차이는 반지름이 아니라
 * 알파와 근접 halo 로 만든다.
 *
 * 1.6 인 근거는 겹침이다. 실측(21명, 나 포함): 겹치는 이웃 중앙값 2명,
 * 최대 5명, 고립 1/21. 이 겹침이 곧 "사람들이 Field 를 만든다"의 전부다.
 *
 * 상태별 세 껍질(STATE_RADIUS)이 들어오면서 중앙값이 3 → 2 로 내려갔다.
 * 六合·沖 이 기본 껍질에서 ±1.5 만큼 떨어져 나갔기 때문이다. 아직 겹치긴
 * 하지만 여기서 껍질 간격을 더 벌리면 구역이 흩어진다 — 그 한계를
 * node-visual.test.ts 의 최근접 거리 중앙값 테스트가 잠근다(현재 2.3644 대 3.2).
 */
export const DIFFUSE_HALO_RADIUS = 1.6;

export type StateVisual = {
  readonly nearRadius: number;
  readonly nearAlpha: number;
  readonly diffuseAlpha: number;
  /** 六合 전용. scale 진폭. 0 이면 호흡하지 않는다. */
  readonly breatheAmplitude: number;
  /** 초. breatheAmplitude 가 0 이면 의미 없다. */
  readonly breathePeriod: number;
};

/**
 * 기본 / 六合 / 沖 의 시각 상수.
 *
 * nearAlpha 의 소수점 넷째 자리는 임의의 값이 아니다 — stateLight 가 세
 * 상태에서 같아지도록 역산한 값이다(설계 문서 4.3). **반지름이나 확산 알파를
 * 만지면 이 값도 다시 풀어야 한다.** 광량 불변식 테스트가 그것을 강제한다.
 */
export const STATE_VISUAL: Record<Feature, StateVisual> = {
  none: {
    nearRadius: 0.28,
    nearAlpha: 0.55,
    diffuseAlpha: 0.07,
    breatheAmplitude: 0,
    breathePeriod: 0,
  },
  yukhap: {
    nearRadius: 0.42, // 넓고
    nearAlpha: 0.4462, // 옅게
    diffuseAlpha: 0.055,
    breatheAmplitude: 0.16,
    breathePeriod: 4.6,
  },
  chung: {
    nearRadius: 0.2, // 좁고
    nearAlpha: 0.758, // 진하게
    diffuseAlpha: 0.075,
    breatheAmplitude: 0,
    breathePeriod: 0,
  },
};

/**
 * 한 상태가 내보내는 적분 광량. `alphaScale` 은 선택·dim 이 두 halo 에 거는
 * 배율(ALPHA_SCALE 의 각 값)을 대입해, 그 배율이 걸린 뒤에도 불변식이
 * 유지되는지 검증할 수 있게 한다 — 기본값 1 은 정지 상태(배율 없음)다.
 *
 * 스프라이트의 적분 밝기는 α × 반지름² 에 비례한다. 호흡은 크기가 시간에 따라
 * 변하므로 scale(t) = 1 + d·sin(ωt) 의 시간 평균 <scale²> = 1 + d²/2 로 보정한다.
 * 이 보정을 빼먹으면 호흡하는 상태가 평균적으로 더 밝아진다.
 *
 * 이 값이 세 상태에서 같아야 "沖이 제일 세다"가 생기지 않는다. 다만 적분
 * 광량이 같다고 지각 밝기가 같지는 않다 — 沖 은 피크 알파가 높고 六合 은
 * 낮으며, 그건 설계 의도다. 불변식이 막는 것은 한 상태가 전체적으로
 * 밝아지는 것뿐이다.
 *
 * 여기엔 클램프(min(1, ...))가 없다 — 클램프는 실제로 화면에 그려지는 컴포넌트의
 * 런타임 백스톱이지 이 계산의 일부가 아니다. ALPHA_SCALE 이 세 상태 중 어느
 * 것도 포화시키지 않도록 골라져 있어야 이 함수가 곧 실제로 그려지는 값과
 * 일치한다 — 그 전제를 "ALPHA_SCALE" 테스트가 지킨다.
 */
export function stateLight(feature: Feature, alphaScale = 1): number {
  const v = STATE_VISUAL[feature];
  const timeAverage = 1 + v.breatheAmplitude ** 2 / 2;
  return (
    (v.nearAlpha * alphaScale * v.nearRadius ** 2 +
      v.diffuseAlpha * alphaScale * DIFFUSE_HALO_RADIUS ** 2) *
    timeAverage
  );
}

/**
 * 선택·dim 이 근접·확산 halo 알파에 거는 배율. 세 상태 모두에 같은 배율이
 * 걸리고, 그 배율은 어떤 상태의 알파도 포화(1을 넘어 클램프)시키지 않도록
 * 골랐다 — 포화되는 순간 그 상태만 실효 배율이 깎여 광량 불변식이 깨진다
 * (PersonNode 의 selected 상태에서 沖 이 그렇게 깨진 적이 있다: 1.5 배율에서
 * 沖 의 nearAlpha 0.758 × 1.5 = 1.137 → 1.0 으로 클램프되어 세 상태 spread 가
 * 1.67% 로 벌어졌다 — 0.5% 문턱의 3배 이상).
 *
 * selected 의 상한은 세 상태 중 nearAlpha 가 가장 큰 沖(0.758)이 정한다:
 * 1 / 0.758 = 1.3193. 1.3 은 그 아래 ~1.5% 여유를 두고, 세 상태가 전부 같은
 * 1.3× 를 그대로 실현하게 한다 — 포화가 없으니 stateLight(f, 1.3) 이 세
 * 상태에서 다시 0.5% 이내로 일치한다(node-visual.test.ts 의 "ALPHA_SCALE"
 * 참고).
 */
export const ALPHA_SCALE = { selected: 1.3, base: 1, dimmed: 0.22 } as const;

export const HALO_TEXTURE_SIZE = 64;

/**
 * 중심 1 → 가장자리 0 의 smoothstep radial falloff. RGBA, RGB 는 흰색 고정이라
 * spriteMaterial.color 가 그대로 색을 입힌다.
 *
 * canvas 로 만들지 않는 이유: "use client" 모듈도 SSR 프리렌더에서 한 번
 * 평가되는데 거기엔 document 가 없다. 순수 수학이면 어디서든 돈다.
 */
export function radialFalloff(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - center, y - center) / center;
      const t = Math.min(1, Math.max(0, 1 - d));
      const a = t * t * (3 - 2 * t); // smoothstep
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }

  return data;
}
