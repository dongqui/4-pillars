// 원국(사주팔자) — manseryeok 결과를 천간/지지 분리 구조로 변환

import {
  calculateSaju,
  lunarToSolar,
  type SajuResult,
} from "@fullstackfamily/manseryeok";
import { isStem, type Stem } from "./data/stems.js";
import { isBranch, type Branch } from "./data/branches.js";

export type Gender = "male" | "female";

export interface BirthInput {
  /** 연 (calendar='lunar'이면 음력 연으로 해석) */
  year: number;
  /** 월 (1~12) */
  month: number;
  /** 일 (1~31) */
  day: number;
  /** 시 (0~23). 미입력 시 시주 없음 */
  hour?: number;
  /** 분 (0~59, 기본 0) */
  minute?: number;
  /** 입력 달력 (기본 solar) */
  calendar?: "solar" | "lunar";
  /** 음력 윤달 여부 */
  isLeapMonth?: boolean;
  gender: Gender;
  /** 경도 (기본 127, 서울) — 진태양시 보정에 사용 */
  longitude?: number;
  /** 진태양시 보정 적용 (기본 true) */
  applyTimeCorrection?: boolean;
}

export interface Pillar {
  /** 한글 간지 (예: "경오") */
  korean: string;
  /** 한자 간지 (예: "庚午") */
  hanja: string;
  /** 천간 */
  stem: Stem;
  /** 지지 */
  branch: Branch;
}

export interface Chart {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 시주 — 출생 시간 미입력 시 null */
  hour: Pillar | null;
  /** 일간(아신) */
  dayMaster: Stem;
  /** 성별 (대운 방향 결정에 사용) */
  gender: Gender;
  /** 계산에 실제 사용된 양력 날짜 */
  solar: { year: number; month: number; day: number; hour: number | null; minute: number };
  /** 원본 라이브러리 결과 */
  raw: SajuResult;
}

function parsePillar(korean: string, hanja: string): Pillar {
  const chars = Array.from(korean);
  const [stem, branch] = chars;
  if (!isStem(stem) || !isBranch(branch)) {
    throw new Error(`알 수 없는 간지: ${korean}`);
  }
  return { korean, hanja, stem, branch };
}

/** 출생 정보로 원국을 계산한다. */
export function buildChart(input: BirthInput): Chart {
  let { year, month, day } = input;
  if (input.calendar === "lunar") {
    const solar = lunarToSolar(year, month, day, input.isLeapMonth ?? false).solar;
    year = solar.year;
    month = solar.month;
    day = solar.day;
  }

  const hasHour = input.hour !== undefined;
  const raw = calculateSaju(year, month, day, input.hour, input.minute ?? 0, {
    longitude: input.longitude,
    applyTimeCorrection: input.applyTimeCorrection,
  });

  const hour =
    hasHour && raw.hourPillar && raw.hourPillarHanja
      ? parsePillar(raw.hourPillar, raw.hourPillarHanja)
      : null;

  const dayPillar = parsePillar(raw.dayPillar, raw.dayPillarHanja);

  return {
    year: parsePillar(raw.yearPillar, raw.yearPillarHanja),
    month: parsePillar(raw.monthPillar, raw.monthPillarHanja),
    day: dayPillar,
    hour,
    dayMaster: dayPillar.stem,
    gender: input.gender,
    solar: { year, month, day, hour: input.hour ?? null, minute: input.minute ?? 0 },
    raw,
  };
}
