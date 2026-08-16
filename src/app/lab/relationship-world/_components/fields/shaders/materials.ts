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
