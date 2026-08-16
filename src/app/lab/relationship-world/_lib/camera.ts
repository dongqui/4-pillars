export type CameraMode = "a" | "b" | "c";

const deg = (d: number) => (d * Math.PI) / 180;

/** 기본 뷰. polar 약 76°, azimuth 0°, 거리 약 13.4 — A/B/C 전부의 범위 안이다. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3.2, 13];
export const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

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
    minDistance: 10.4,
    maxDistance: 15.6,
    enablePan: false,
  },
  // B · 중간
  b: {
    minPolar: deg(35),
    maxPolar: deg(100),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: 7.8,
    maxDistance: 20.8,
    enablePan: false,
  },
  // C · 자유 + Reset
  c: {
    minPolar: deg(15),
    maxPolar: deg(140),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: 5.2,
    maxDistance: 32.5,
    enablePan: true,
  },
};

export const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: "a", label: "A 제한" },
  { value: "b", label: "B 중간" },
  { value: "c", label: "C 자유" },
];
