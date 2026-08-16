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

void main() {
  float rim = fresnel(vNormalW, vViewDirW, 2.4);
  float n = noise2(vPosL * 0.55 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  float a = rim * (0.45 + n * 0.55) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const MistMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#d2cec7"), uOpacity: 0.5 },
  SHELL_VERTEX,
  MIST_FRAGMENT,
);

extend({ MistMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    mistMaterial: ThreeElement<typeof MistMaterial>;
  }
}
