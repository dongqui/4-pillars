import type { BirthInput } from "@/lib/saju-core";
import { findRegion, type Country } from "@/lib/regions";
import type { ReportSubject } from "./subject";

/** ProfileRow.birthPlace.country 는 DB 에서 온 string 이라 좁혀서 쓴다. */
function toCountry(v: string): Country | null {
  return v === "KR" || v === "JP" ? v : null;
}

/**
 * 저장된 프로필을 사주 계산 입력으로 되돌린다.
 * 퍼널의 toBirthInput(FunnelData 기준)과 나란한 자리 — 이쪽은 DB 행 기준이다.
 */
export function toBirthInput(profile: ReportSubject): BirthInput {
  const { birth, time, birthPlace } = profile;
  const country = birthPlace ? toCountry(birthPlace.country) : null;

  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: time?.hour,
    minute: time?.minute,
    calendar: profile.calendar,
    isLeapMonth: profile.calendar === "lunar" ? profile.isLeapMonth : undefined,
    gender: profile.gender,
    // 출생지를 건너뛴(또는 모르는 지역인) 프로필은 경도를 남기지 않는다 —
    // saju-core 가 기본값 127(서울)을 쓴다. 퍼널은 브라우저 로케일로 국가
    // 기본값을 골랐지만 서버에는 그 정보가 없다.
    longitude: country && birthPlace
      ? findRegion(country, birthPlace.regionId)?.lon
      : undefined,
    applyTimeCorrection: profile.trueSolar,
  };
}
