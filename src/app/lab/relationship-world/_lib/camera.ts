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
 * 기본 뷰는 월드를 전부 담지 않는다. 나와 인접 Field 2~4개가 크게 보이고,
 * 나머지는 드래그해서 찾아가는 것이 이번 설계의 의도다(설계 문서 6절).
 * 전부 담으려면 거리 41 이 필요한데, 그러면 Field 하나하나가 작아져
 * "성질이 다른 공간"이 보이지 않는다 — 재설계의 목적 자체가 사라진다.
 *
 * 방향은 예전 [0, 3.2, 13] 과 완전히 같고(3.2:13 비율 유지) 거리만 2 배 밀었다.
 * 거리 26 에서는 나(원점)가 화면 안에 있고, Field 중심 5개 중 2~4개가
 * 보인다(layout.test.ts 가 잠근다) — 나머지는 화면 밖에 있어 드래그해야 한다.
 *
 * 월드 좌표(layout.ts)는 건드리지 않았다. 거리만 바꾸면 화면상 배치는 데스크톱
 * 기준 뷰와 동일한 구도가 그대로 축소돼 들어오고, 좌표 규칙 테스트도 그대로 산다.
 */
const DEFAULT_BASE_Z = 26;
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 6.4, DEFAULT_BASE_Z];
export const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

/** 설계 문서 10절의 zoom 배율. 기준 길이만 13 → 40 으로 옮겼다. */
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
    minDistance: zoom(0.8), // 32
    maxDistance: zoom(1.2), // 48
    enablePan: false,
  },
  // B · 중간
  b: {
    minPolar: deg(35),
    maxPolar: deg(100),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.6), // 24
    maxDistance: zoom(1.6), // 64
    enablePan: false,
  },
  // C · 자유 + Reset
  c: {
    minPolar: deg(15),
    maxPolar: deg(140),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.4), // 16
    maxDistance: zoom(2.5), // 100
    enablePan: true,
  },
};

export const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: "a", label: "A 제한" },
  { value: "b", label: "B 중간" },
  { value: "c", label: "C 자유" },
];
