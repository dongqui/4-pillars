/** 시드 해시. Math.random 을 안 쓰듯 셰이더도 결정론적이어야 한다. */
export const GLSL_HASH = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

/** 2옥타브. 더 쌓지 않는다 — 폰에서 픽셀당 비용이 그대로 곱해진다. */
float noise2(vec3 p) {
  return valueNoise(p) * 0.65 + valueNoise(p * 2.03) * 0.35;
}
`;

export const GLSL_FRESNEL = /* glsl */ `
float fresnel(vec3 normalW, vec3 viewDirW, float power) {
  return pow(1.0 - clamp(dot(normalize(normalW), normalize(viewDirW)), 0.0, 1.0), power);
}
`;
