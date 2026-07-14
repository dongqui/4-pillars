import type { Country } from "./regions";

export type Locale = "ko" | "ja";

/**
 * 현재 locale. i18n 도입 전까지 "ko" 고정.
 * 추후 i18n이 붙으면 이 함수 내부만 교체한다.
 */
export function getLocale(): Locale {
  return "ko";
}

export function localeToCountry(locale: Locale): Country {
  return locale === "ja" ? "JP" : "KR";
}
