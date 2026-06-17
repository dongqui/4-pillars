// @4-pillars/content — 룰 기반 사주 콘텐츠 (ko/ja) (스텁)

import type { Locale } from "@4-pillars/types";

/** 콘텐츠 조각 키 (예: 일간 + 십성 조합) */
export type ContentKey = string;

/** 로케일별 콘텐츠 사전 (미구현 — 빈 사전) */
export const content: Record<Locale, Record<ContentKey, string>> = {
  ko: {},
  ja: {},
};
