import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { GLSL_FRESNEL, GLSL_HASH } from "./common";

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
extend({ MistMaterial });

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
  float flow = fract(vUv.x * 2.6 - uTime * 0.06 + uPhase);
  float streak = smoothstep(0.5, 0.0, abs(flow - 0.5) * 2.0);
  float grain = noise2(vec3(vUv * 6.0, uPhase));

  // 사각형 경계를 지운다.
  vec2 d = (vUv - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.15, length(d));

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

extend({ LayerMaterial });

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
  float outward = smoothstep(1.0, 0.05, vUv.y);
  // 폭 방향은 가운데만 남긴다.
  float across = smoothstep(0.5, 0.0, abs(vUv.x - 0.5) * 2.0);
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

extend({ RayMaterial });

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
  float head = fract(vUv.x * 1.4 - uTime * 0.13 + uPhase);
  float flow = smoothstep(0.42, 0.0, abs(head - 0.5));
  // 양 끝은 부드럽게 사라지게 해서 잘린 튜브로 안 보이게 한다.
  float ends = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

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

extend({ RibbonMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    ribbonMaterial: ThreeElement<typeof RibbonMaterial>;
  }
}
