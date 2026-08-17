import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import type { ThreeElement } from "@react-three/fiber";
import { GLSL_FRESNEL, GLSL_HASH } from "./common";

/**
 * 이 파일은 마테리얼 클래스만 만든다. R3F 카탈로그 등록(`extend`)은 여기가 아니라
 * **그 마테리얼을 실제로 렌더하는 컴포넌트 쪽**에 있다.
 *
 * 여기서 extend 를 부르면 조용히 통째로 죽는다. `<mistMaterial>` 같은 소문자 JSX
 * 태그는 문자열 intrinsic 이라 MistMaterial 바인딩을 참조하지 않고, 컴포넌트가
 * 그 바인딩을 쓰는 곳은 `InstanceType<typeof MistMaterial>` 뿐 — 전부 타입
 * 위치다. 그러면 TS/SWC 의 import elision 이 `import { MistMaterial } from
 * "./shaders/materials"` 를 트랜스파일 단계에서 **삭제**하고, 이 모듈은 런타임
 * 모듈 그래프에 아예 들어오지 않는다. extend 가 한 번도 실행되지 않아
 * "R3F: MistMaterial is not part of the THREE namespace!" 로 다섯 Field 가
 * 전부 죽는다. 타입만 맞으면 되는 코드라 빌드도 테스트도 통과한다 — 실제로
 * 그렇게 통과한 채 머지됐었다.
 *
 * 등록을 사용처에 두면 `extend({ MistMaterial })` 의 객체 리터럴이 **값** 사용이
 * 되어 import 가 살아남는다. materials.test.ts 가 다섯 컴포넌트 전부에 대해
 * 이 import 가 트랜스파일 후에도 남는지 잠근다.
 */

const VARYINGS = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
varying vec3 vPosL;
`;

const SHELL_VERTEX = /* glsl */ `
${VARYINGS}
void main() {
  vPosL = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/** 감싸는 안개: 가장자리만 밝고 안쪽은 비어 보이게 fresnel 로 깎는다. */
const MIST_FRAGMENT = /* glsl */ `
${VARYINGS}
${GLSL_HASH}
${GLSL_FRESNEL}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uCamDist;
uniform float uShellRadius;

void main() {
  float rim = fresnel(vNormalW, vViewDirW, 2.4);
  float n = noise2(vPosL * 0.55 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  // 카메라가 셸 반지름 안으로 들어오면 DoubleSide 셸 3겹이 화면 전체를
  // 6겹 오버드로우로 덮는다(정면+후면이 모든 방향에서 두 번씩 보임).
  // 반지름의 0.65~1.15배 구간에서 smoothstep 으로 미리 죽여, "안개 안에
  // 서 있는" 상태에서는 실제로 안개가 비어 보이게 한다. 루프도 추가 노이즈
  // 호출도 없는 스칼라 비교 하나뿐이라 비용은 거의 0 이다.
  float proximity = smoothstep(uShellRadius * 0.65, uShellRadius * 1.15, uCamDist);
  float a = rim * (0.45 + n * 0.55) * uOpacity * proximity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const MistMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#d2cec7"),
    uOpacity: 0.5,
    uCamDist: 999,
    uShellRadius: 1,
  },
  SHELL_VERTEX,
  MIST_FRAGMENT,
);

/**
 * uOpacity 는 useFrame 안에서 `m.uniforms.uOpacity.value += ...` 로 매 프레임
 * 직접 램프(lerp)된다. 아래 FillVolume 의 JSX 는 `uOpacity={0.5}` 처럼
 * 하드코딩된 리터럴만 선언적으로 넘기기 때문에, React/R3F 의 prop diffing 이
 * 매 렌더에서 "이전과 같은 값"으로 보고 절대 다시 적용하지 않는다 — 그래서
 * useFrame 의 애니메이션이 방해받지 않고 이어진다.
 *
 * Task 3~6 이 이 파일을 복사할 때 반드시 지킬 규칙: 애니메이션 중인 유니폼의
 * 선언적 prop 에는 절대 "state 에서 파생된 값"을 넘기지 말 것. 그런 값을
 * 넘기면 컴포넌트가 리렌더될 때마다(즉 그 state 가 바뀔 때마다) React 가
 * prop 을 다시 적용해서 useFrame 의 램프를 그 값으로 스냅시켜 버리고,
 * 애니메이션이 리렌더마다 끊기고 튄다. 시간에 따라 바뀌어야 하는 값은
 * 항상 ref 를 통해 uniforms.xxx.value 로만 건드리고, JSX prop 에는 상수만
 * 남겨 둔다 (uShellRadius 처럼 렌더마다 같은 값으로 재계산되는 리터럴은 안전).
 */

declare module "@react-three/fiber" {
  interface ThreeElements {
    mistMaterial: ThreeElement<typeof MistMaterial>;
  }
}

const LAYER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LAYER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
${GLSL_HASH}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;
uniform float uCamDist;
uniform float uRadius;

void main() {
  // 한 방향으로만 흐른다 — '나란히'가 움직임으로 읽혀야 한다.
  //
  // 아래 두 항은 "값이 커질수록 어두워지는" 감쇠라서 smoothstep(큰, 작은, x) 로
  // 쓰고 싶어지지만, GLSL ES 1.00 은 edge0 >= edge1 일 때 결과가 **정의되지
  // 않는다**. 드라이버가 0 을 돌려주는 폰이면 beside·express·move 세 Field 가
  // 통째로 사라지고, 스파이크는 "3D 가 별로다"라는 거짓 결론을 낸다.
  // 그래서 전부 1.0 - smoothstep(작은, 큰, x) 로 뒤집어 쓴다.
  float flow = fract(vUv.x * 2.6 - uTime * 0.06 + uPhase);
  float streak = 1.0 - smoothstep(0.0, 0.5, abs(flow - 0.5) * 2.0);
  float grain = noise2(vec3(vUv * 6.0, uPhase));

  // 사각형 경계를 지운다.
  vec2 d = (vUv - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.15, 1.0, length(d));

  // FillVolume 의 셸과 같은 이유다: 카메라가 층 사이로 들어오면 4장의
  // DoubleSide 평면이 화면 전체를 덮는 오버드로우가 된다. 반지름의
  // 0.65~1.15배 구간에서 smoothstep 으로 미리 죽여 "층 사이에 서 있는"
  // 상태에서는 실제로 비어 보이게 한다.
  float proximity = smoothstep(uRadius * 0.65, uRadius * 1.15, uCamDist);

  float a = streak * edge * (0.35 + grain * 0.65) * uOpacity * proximity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const LayerMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#c9cdd2"),
    uOpacity: 0.42,
    uPhase: 0,
    uCamDist: 999,
    uRadius: 1,
  },
  LAYER_VERTEX,
  LAYER_FRAGMENT,
);

declare module "@react-three/fiber" {
  interface ThreeElements {
    layerMaterial: ThreeElement<typeof LayerMaterial>;
  }
}

const RAY_FRAGMENT = /* glsl */ `
varying vec2 vUv;
${GLSL_HASH}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;
uniform float uCamDist;
uniform float uRadius;

void main() {
  // vUv.y = 0 이 코어, 1 이 바깥 끝이다.
  // 1.0 - smoothstep(작은, 큰, x) 형태인 이유는 LAYER_FRAGMENT 주석 참고
  // (GLSL ES 1.00 은 edge0 >= edge1 을 정의하지 않는다).
  float outward = 1.0 - smoothstep(0.05, 1.0, vUv.y);
  // 폭 방향은 가운데만 남긴다.
  float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5) * 2.0);
  float pulse = 0.65 + 0.35 * sin(uTime * 0.8 + uPhase + vUv.y * 3.0);
  float grain = noise2(vec3(vUv * 4.0, uPhase));

  // FillVolume/BesideLayers 와 같은 이유다: C 모드는 minDistance 10.4 라
  // 카메라가 광선 다발 안쪽까지 들어올 수 있다. 반지름의 0.65~1.15배 구간에서
  // smoothstep 으로 미리 죽여 "광선 사이에 서 있는" 상태에서 9장의 DoubleSide
  // 평면이 additive 로 겹쳐 화면을 덮는 오버드로우를 막는다.
  float proximity = smoothstep(uRadius * 0.65, uRadius * 1.15, uCamDist);

  float a = outward * across * pulse * (0.4 + grain * 0.6) * uOpacity * proximity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const RayMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#c2cbd6"),
    uOpacity: 0.5,
    uPhase: 0,
    uCamDist: 999,
    uRadius: 1,
  },
  LAYER_VERTEX,
  RAY_FRAGMENT,
);

declare module "@react-three/fiber" {
  interface ThreeElements {
    rayMaterial: ThreeElement<typeof RayMaterial>;
  }
}

const RIBBON_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;
uniform float uCamDist;
uniform float uRadius;

void main() {
  // 길이를 따라 계속 흘러간다 — 멈추면 '움직이게 한다'가 죽는다.
  // 1.0 - smoothstep(작은, 큰, x) 형태인 이유는 LAYER_FRAGMENT 주석 참고
  // (GLSL ES 1.00 은 edge0 >= edge1 을 정의하지 않는다).
  float head = fract(vUv.x * 1.4 - uTime * 0.13 + uPhase);
  float flow = 1.0 - smoothstep(0.0, 0.42, abs(head - 0.5));
  // 양 끝은 부드럽게 사라지게 해서 잘린 튜브로 안 보이게 한다.
  float ends = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));

  // 다른 Field 들과 같은 이유다: C 모드는 minDistance 10.4 라 카메라가 리본
  // 다발 안으로 들어올 수 있다. 반지름의 0.65~1.15배 구간에서 smoothstep 으로
  // 미리 죽여 "리본 사이에 서 있는" 상태에서 3가닥의 DoubleSide 튜브가
  // additive 로 겹쳐 화면을 덮는 오버드로우를 막는다.
  float proximity = smoothstep(uRadius * 0.65, uRadius * 1.15, uCamDist);

  float a = (0.22 + flow * 0.78) * ends * uOpacity * proximity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

// LAYER_VERTEX 는 Task 3 에서 이미 이 파일에 정의돼 있다(uv 만 넘기는 최소 정점
// 셰이더). 튜브도 uv 만 있으면 되므로 그대로 재사용한다 — 새로 만들지 말 것.
export const RibbonMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#bac6d6"),
    uOpacity: 0.55,
    uPhase: 0,
    uCamDist: 999,
    uRadius: 1,
  },
  LAYER_VERTEX,
  RIBBON_FRAGMENT,
);

declare module "@react-three/fiber" {
  interface ThreeElements {
    ribbonMaterial: ThreeElement<typeof RibbonMaterial>;
  }
}

/** 결정/파편: 면은 어둡고 모서리만 밝다 — 각진 실루엣이 그대로 읽혀야 한다. */
const SHARD_FRAGMENT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
varying vec3 vPosL;
${GLSL_FRESNEL}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uCamDist;
uniform float uRadius;

void main() {
  float rim = fresnel(vNormalW, vViewDirW, 3.2);
  float facet = 0.16 + 0.84 * rim;
  // 다른 Field 들과 같은 이유다: C 모드는 minDistance 10.4 라 카메라가 격자
  // 안까지 들어올 수 있다. 반지름의 0.65~1.15배 구간에서 smoothstep 으로
  // 미리 죽여 "결정 격자 안에 서 있는" 상태에서 26개의 octahedron 이 화면을
  // 덮는 오버드로우를 막는다.
  //
  // uRadius 는 반드시 그 Field 의 **진짜** 바운딩 반지름이어야 한다. 부풀려
  // 넘기면 "완전히 보이는" 거리가 같은 배율로 밀려나 C 모드에서 핀치 한 번에
  // 본체가 통째로 사라진다 — 값은 geometry.ts 의 FIELD_FADE_RADIUS 하나에서만
  // 나오고, 그 주석에 전말이 적혀 있다.
  float proximity = smoothstep(uRadius * 0.65, uRadius * 1.15, uCamDist);
  float a = facet * uOpacity * proximity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const ShardMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#b6c2d4"),
    uOpacity: 0.72,
    uCamDist: 999,
    uRadius: 1,
  },
  SHELL_VERTEX,
  SHARD_FRAGMENT,
);

// SHELL_VERTEX 를 재사용한다(LAYER_VERTEX 가 아니다) — fresnel 에 법선과 시선이
// 필요하고, 그건 FillVolume 의 안개 정점 셰이더가 이미 넘긴다. LAYER_VERTEX 는
// uv 만 넘겨서 vNormalW/vViewDirW 가 undefined 로 남는다.

declare module "@react-three/fiber" {
  interface ThreeElements {
    shardMaterial: ThreeElement<typeof ShardMaterial>;
  }
}
