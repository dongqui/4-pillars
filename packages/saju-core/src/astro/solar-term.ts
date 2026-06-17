// 절기(節氣) 일시 계산 — 태양 겉보기 황경(apparent ecliptic longitude) 기반
//
// 라이브러리(manseryeok)의 정밀 절기는 2020~2030만 지원하므로, 전 범위(1900~2050)
// 대운 계산을 위해 절기 순간을 직접 계산한다. Meeus의 저정밀 태양 위치 알고리즘
// (Astronomical Algorithms, ch.25)을 쓰고, 황경이 목표값이 되는 순간을 뉴턴법으로 찾는다.
// 결과는 한국 표준시(KST, UTC+9) 시계 기준 JD/날짜로 돌려준다.

const RAD = Math.PI / 180;

/** 월(月)을 바꾸는 12절기 — 황경 순서 */
export const MONTH_TERMS = [
  { name: "입춘", longitude: 315 },
  { name: "경칩", longitude: 345 },
  { name: "청명", longitude: 15 },
  { name: "입하", longitude: 45 },
  { name: "망종", longitude: 75 },
  { name: "소서", longitude: 105 },
  { name: "입추", longitude: 135 },
  { name: "백로", longitude: 165 },
  { name: "한로", longitude: 195 },
  { name: "입동", longitude: 225 },
  { name: "대설", longitude: 255 },
  { name: "소한", longitude: 285 },
] as const;

export interface CalendarTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** 태양 겉보기 황경 (도, 0~360). jde는 역학시(TT) 기준 율리우스일. */
export function sunApparentLongitude(jde: number): number {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * RAD;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  return ((lambda % 360) + 360) % 360;
}

/** ΔT(초) 근사 — Espenak & Meeus, 2005~2050 구간 (이 서비스 대상 구간에 충분). */
function deltaTSeconds(year: number): number {
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/** 그레고리력 → 율리우스일 (day는 소수 가능, 입력 시계 기준) */
export function gregorianToJD(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    B -
    1524.5
  );
}

/** 율리우스일 → 그레고리력 (입력 시계 기준) */
export function jdToCalendar(jd: number): CalendarTime {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let A: number;
  if (z < 2299161) {
    A = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayWithFrac = B - D - Math.floor(30.6001 * E) + f;
  const day = Math.floor(dayWithFrac);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  // 시·분 (초 반올림 후 자리올림 정규화)
  let totalMinutes = Math.round((dayWithFrac - day) * 24 * 60);
  let d = day;
  let hour = Math.floor(totalMinutes / 60);
  let minute = totalMinutes % 60;
  if (hour >= 24) {
    hour -= 24;
    d += 1;
  }
  return { year, month, day: d, hour, minute };
}

/** 황경이 target(도)이 되는 순간의 JDE(TT)를 뉴턴법으로 구한다. */
export function solarTermJDE(year: number, targetLongitude: number): number {
  // 초기 추정: 춘분(황경0)≈연중 79일째, 약 0.98565°/일 진행. 해당 연도 내로 보정.
  const approxDayOfYear =
    (((79 + targetLongitude / 0.98565 - 1) % 365.2422) + 365.2422) % 365.2422;
  let jde = gregorianToJD(year, 1, 1) + approxDayOfYear;

  for (let i = 0; i < 60; i++) {
    const lon = sunApparentLongitude(jde);
    let diff = targetLongitude - lon;
    diff = (((diff + 180) % 360) + 360) % 360 - 180; // [-180,180)
    jde += (diff * 365.2422) / 360;
    if (Math.abs(diff) < 1e-7) break;
  }
  return jde;
}

/** 절기 순간의 JD (KST 시계 기준). 일수 차 계산용. */
export function solarTermJD(year: number, targetLongitude: number): number {
  const jdeTT = solarTermJDE(year, targetLongitude);
  return jdeTT - deltaTSeconds(year) / 86400 + 9 / 24;
}

/** 절기 순간의 날짜·시각 (KST). */
export function solarTermDate(year: number, targetLongitude: number): CalendarTime {
  return jdToCalendar(solarTermJD(year, targetLongitude));
}
