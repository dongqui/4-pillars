// @4-pillars/types — 공통 타입 (스텁)

/** 지원 로케일 */
export type Locale = "ko" | "ja";

/** 십간 (천간) */
export type HeavenlyStem = string;

/** 십이지 (지지) */
export type EarthlyBranch = string;

/** 사주 한 기둥 (천간 + 지지) */
export interface Pillar {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
}

/** 사주 원국 (년/월/일/시주) */
export interface SajuChart {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
}
