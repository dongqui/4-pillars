// @4-pillars/saju-core — 사주 원국 계산 (스텁)
// manseryeok-js 래핑 예정. 현재는 시그니처만 정의.

import type { SajuChart } from "@4-pillars/types";

export interface BirthInput {
  /** ISO 8601 출생 일시 (예: "1990-03-15T07:30:00") */
  birthDateTime: string;
  /** 양력/음력 */
  calendar: "solar" | "lunar";
  gender: "male" | "female";
}

/** 출생 정보로 사주 원국을 계산한다. (미구현) */
export function calculateSaju(_input: BirthInput): SajuChart {
  throw new Error("calculateSaju: not implemented");
}
