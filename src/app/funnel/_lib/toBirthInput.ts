import type { BirthInput } from "@/lib/saju-core";
import type { FunnelData } from "../_context/FunnelContext";
import { getLocale, localeToCountry } from "./locale";
import { resolveLongitude } from "./regions";

/**
 * 퍼널 입력을 사주 API 입력으로 변환한다.
 * 경도는 출생지(스킵 시 국가 기본), 보정 여부는 trueSolar를 따른다.
 *
 * 사용처: 리뷰 → 분석 시작 시 POST /api/saju 배선 지점에서 호출.
 */
export function toBirthInput(data: FunnelData): BirthInput {
  if (!data.birth || !data.gender) {
    throw new Error("생년월일·성별이 필요합니다");
  }

  const country = localeToCountry(getLocale());
  const hasTime = data.timeKnown && data.time !== null;

  return {
    year: data.birth.y,
    month: data.birth.m,
    day: data.birth.d,
    hour: hasTime ? data.time!.h : undefined,
    minute: hasTime ? data.time!.m : undefined,
    calendar: data.calendar,
    gender: data.gender,
    longitude: resolveLongitude(data.birthPlace, country),
    applyTimeCorrection: data.trueSolar,
  };
}
