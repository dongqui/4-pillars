export type CameraMode = "a" | "b" | "c";

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * 수직 fov 다. three 의 fov 는 언제나 수직이라, 가로 화각은 종횡비가 곱해진
 * atan(tan(fov/2)·aspect) 로 줄어든다. 375×812(aspect 0.462)에서 가로 반각은
 * 12.2° 뿐이다 — 이 상수를 키워서 폭을 벌 수는 없다. 필요한 폭을 fov 로만
 * 채우려면 수직 112° 가 필요하고 그 각도는 화면 가장자리를 심하게 왜곡한다.
 * 그래서 폭은 fov 가 아니라 '거리'로 번다(아래 DEFAULT_CAMERA_POSITION).
 */
export const CAMERA_FOV = 50;

/**
 * 이번 설계(구면 앵커 5개 × 소구역 3개, layout.ts)는 기본 뷰에서 다섯 Role
 * 구역과 21명(나 포함) 전원이 375×812 진입 화면 안에 들어오는 것을 목표로
 * 한다 — 직전 설계는 나와 인접 Field 2~4개만 보이고 나머지는 드래그해야
 * 찾을 수 있었고, 그것이 "위치가 아무 정보도 주지 않는다"는 실패로
 * 이어졌다. layout.test.ts 의 "5개 앵커가 전부 화면 안에 있다" 와
 * "20명 전원이 화면 안에 투영된다" 가 이 목표를 잠근다.
 *
 * 방향은 예전 [0, 3.2, 13] 과 완전히 같다(3.2:13 비율 유지). 거리(DEFAULT_BASE_Z)
 * 는 이 폭을 벌기 위해 조정된 값이고, ANCHOR_RADIUS(layout.ts, 7)를 포함해
 * 화면에 다섯 구역이 다 들어오도록 함께 맞춰졌다.
 */
const DEFAULT_BASE_Z = 26;
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 6.4, DEFAULT_BASE_Z];
export const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

/** 설계 문서 10절의 zoom 배율. 기준 길이만 13 → 26 으로 옮겼다. */
const zoom = (factor: number) => +(DEFAULT_BASE_Z * factor).toFixed(2);

export const CAMERA_LIMITS: Record<
  CameraMode,
  {
    minPolar: number;
    maxPolar: number;
    minAzimuth: number;
    maxAzimuth: number;
    minDistance: number;
    maxDistance: number;
    enablePan: boolean;
  }
> = {
  // A · 제한적
  a: {
    minPolar: deg(60),
    maxPolar: deg(85),
    minAzimuth: deg(-35),
    maxAzimuth: deg(35),
    minDistance: zoom(0.8), // 20.8
    maxDistance: zoom(1.2), // 31.2
    enablePan: false,
  },
  // B · 중간
  b: {
    minPolar: deg(35),
    maxPolar: deg(100),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.6), // 15.6
    maxDistance: zoom(1.6), // 41.6
    enablePan: false,
  },
  // C · 자유 + Reset
  c: {
    minPolar: deg(15),
    maxPolar: deg(140),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.4), // 10.4
    maxDistance: zoom(2.5), // 65
    enablePan: true,
  },
};

export const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: "a", label: "A 제한" },
  { value: "b", label: "B 중간" },
  { value: "c", label: "C 자유" },
];
