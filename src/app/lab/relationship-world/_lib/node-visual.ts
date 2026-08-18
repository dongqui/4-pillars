/**
 * 사람 Node 의 시각 상수와 halo 텍스처 데이터.
 *
 * three 를 import 하지 않는다. 텍스처 '데이터'만 순수 함수로 만들고, 실제
 * THREE.DataTexture 조립은 PersonNode.tsx 가 한다 — 그래야 이 규칙들이 node
 * 환경 테스트로 잠긴다.
 *
 * 아래 값 중 DIFFUSE_HALO_* 두 개는 계산으로 정했을 뿐 렌더된 화면에서
 * 검증되지 않았다. 실물을 보고 조절할 곳이 여기 하나다.
 */

/** 코어. 사람의 위치 그 자체. opaque 로 그려서 깊이 버퍼에 참여한다. */
export const CORE_RADIUS = 0.075;

/** 나만 코어가 조금 크다. 색은 다른 사람과 같은 규칙(SELF 의 pillarKey)을 따른다. */
export const SELF_CORE_SCALE = 1.4;

/** 노드를 또렷하게 만드는 좁은 halo. */
export const NEAR_HALO_RADIUS = 0.28;

/**
 * 사람이 모인 자리에만 색 기운을 남기는 넓은 halo.
 *
 * 이 값은 사람 간 **최근접 거리의 분포**에서 나온다. 최소 간격 0.4354 를
 * 근거로 삼으면 안 된다 — 그건 210개 쌍 중 가장 가까운 한 쌍의 값이고(이
 * 0.4354 는 `layout.test.ts` 의 `toBeGreaterThan(0.35)` 로 잠겨 있지도
 * 않다, 실측값일 뿐이다), 최근접 거리의 중앙값은 1.93 으로 4.4배 크다.
 * 실제로 0.95 를 쓰면 중앙값 사람의 겹치는 이웃이 0명, 21명 중 12명이
 * 아무와도 겹치지 않아 "사람들이 Field 를 만든다"가 그냥 일어나지 않는다.
 *
 * 1.6 에서 중앙값 2명과 겹치고 고립되는 사람은 2명뿐이다. additive 라
 * 겹친 만큼 밝아진다. **이것이 '사람들이 Field 를 만든다'의 전부다** —
 * 별도의 안개나 볼륨 오브젝트를 두면 지워버린 Field 가 축소판으로 돌아온다.
 *
 * 진입 화면(375px)에서 지름 약 104px, 화면폭의 28% 다. 실물을 보고 조절할
 * 값이 이 파일에서 이것 하나다.
 */
export const DIFFUSE_HALO_RADIUS = 1.6;

export const HALO_ALPHA = {
  near: { base: 0.55, selected: 0.85, dimmed: 0.12 },
  diffuse: { base: 0.07, selected: 0.12, dimmed: 0.015 },
} as const;

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
