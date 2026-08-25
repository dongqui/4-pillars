// 화면 섹션의 번호·라벨·제목을 정하는 유일한 자리.
//
// 제목이 두 출처에서 온다 — 유형 무관 다섯(01·02·04·05·08)은 고정, 유형별
// 다섯은 RELATION_COPY. 이걸 JSX 안에서 섞으면 번호와 제목이 조건문에 흩어진다.

import type { RelationInput } from "@/lib/matches/relation-types";
import {
  VARIANT_SECTION_KEYS,
  relationCopy,
  type VariantSectionKey,
} from "@/lib/matches/relation-copy";

/**
 * 화면 섹션 열 개. 콜 키(일곱 개)와 다른 축이다 — bond 한 콜이 eachSide·change 두
 * 화면을 만든다.
 *
 * VariantSectionKey 를 유니온 안에 그대로 넣어 부분집합 관계를 타입이 붙들게 한다.
 * 따로 나열하면 두 목록이 어긋나도 컴파일이 통과한다.
 */
export type ScreenSectionKey =
  | "verdict" // 01
  | "chemistry" // 02
  | "eachSide" // 04
  | "change" // 05
  | "triggers" // 08
  | VariantSectionKey; // 03 · 06 · 07 · 09 · 10

export interface SectionHeadingView {
  no: string;
  category: string;
  /** null = 제목이 카피가 아니라 내용에서 온다. 01 은 verdict.headline 을 제목으로 쓴다. */
  title: string | null;
}

/** 화면에 그려지는 순서. MatchBody 가 이 순서대로 세로로 쌓는다. */
export const SCREEN_SECTION_ORDER = [
  "verdict",
  "chemistry",
  "closeness",
  "eachSide",
  "change",
  "presence",
  "continuity",
  "triggers",
  "recovery",
  "advice",
] as const satisfies readonly ScreenSectionKey[];

/** 유형과 무관하게 고정인 다섯. Exclude 가 유형별 다섯을 빼 주므로 목록이 어긋날 수 없다. */
const FIXED = {
  verdict: { no: "01", category: "총평", title: null },
  chemistry: { no: "02", category: "케미", title: "끌리는 지점과 부딪히는 지점" },
  eachSide: { no: "04", category: "서로에게", title: "같은 관계, 다르게 보이는 자리" },
  change: {
    no: "05",
    category: "함께할수록 달라지는 것",
    title: "이 관계가 서로에게 남기는 변화",
  },
  triggers: { no: "08", category: "흔들리는 순간", title: "관계가 흔들리기 쉬운 국면" },
} as const satisfies Record<Exclude<ScreenSectionKey, VariantSectionKey>, SectionHeadingView>;

const VARIANT_NO = {
  closeness: "03",
  presence: "06",
  continuity: "07",
  recovery: "09",
  advice: "10",
} as const satisfies Record<VariantSectionKey, string>;

export function matchSectionHeadings(
  relation: RelationInput,
): Record<ScreenSectionKey, SectionHeadingView> {
  const out = { ...FIXED } as Record<ScreenSectionKey, SectionHeadingView>;
  for (const key of VARIANT_SECTION_KEYS) {
    const copy = relationCopy(relation, key);
    out[key] = { no: VARIANT_NO[key], category: copy.category, title: copy.title };
  }
  return out;
}
