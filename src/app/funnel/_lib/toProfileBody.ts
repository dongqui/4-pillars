import type { CreateProfileBody } from "@/app/api/profiles/_lib/input";
import type { FunnelData } from "../_context/FunnelContext";

/**
 * 퍼널 입력을 POST /api/profiles 본문으로 변환한다.
 * toBirthInput 과 나란한 자리 — 그쪽은 사주 계산용(경도로 접힌다), 이쪽은 저장용
 * (출생지를 그대로 남겨 나중에 다시 계산할 수 있게 한다).
 */
export function toProfileBody(data: FunnelData): CreateProfileBody {
  if (!data.birth || !data.gender) {
    throw new Error("생년월일·성별이 필요합니다");
  }
  const hasTime = data.timeKnown && data.time !== null;

  return {
    name: data.name.trim(),
    gender: data.gender,
    calendar: data.calendar,
    isLeapMonth: data.calendar === "lunar" ? data.isLeapMonth : false,
    birth: { year: data.birth.y, month: data.birth.m, day: data.birth.d },
    timeKnown: data.timeKnown,
    time: hasTime ? { hour: data.time!.h, minute: data.time!.m } : null,
    birthPlace: data.birthPlace
      ? { country: data.birthPlace.country, regionId: data.birthPlace.regionId }
      : null,
    trueSolar: data.trueSolar,
  };
}
