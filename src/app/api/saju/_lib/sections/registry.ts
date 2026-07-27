import { z } from "zod";
import { KeyValue, LabeledText, TimelineNote, TitledText } from "./primitives";

/** 무료 노출 여부. 어떤 키를 실제로 요청할지는 호출자가 정한다. */
export type SectionTier = "free" | "paid";

/**
 * 저장 테이블. "chart" 는 4기둥+성별(chartKey)로 캐시되고,
 * "luck" 은 정확한 생시에 의존해 luckKey 로 따로 캐시된다.
 */
export type SectionStorage = "chart" | "luck";

export interface SectionSpec {
  /** 이 섹션 스키마의 버전. DB schema_version 컬럼에 기록된다. shape 을 바꾸면 올린다. */
  version: number;
  tier: SectionTier;
  storage: SectionStorage;
  /** content 의 유일한 shape 정의. 타입·LLM 스키마·런타임 검증이 전부 여기서 나온다. */
  schema: z.ZodType;
  /** 이 섹션만 재생성할 때 LLM 에 줄 지시문 */
  prompt: string;
}

const shortList = (min: number, max: number) => z.array(z.string().min(1)).min(min).max(max);

/**
 * 해석 섹션의 유일한 정의. section_key = 이 객체의 키.
 *
 * 계산값(원국·오행·신강약·대운 기간)은 여기 없다. LLM 서술만 담고,
 * 숫자는 조립 단계에서 SajuAnalysis 로 채운다 — LLM 이 숫자를 지어내지 못하게 하려고.
 */
export const SECTIONS = {
  overview: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({
        headline: z.string().min(1),
        summary: z.string().min(1),
        keywords: shortList(3, 6),
      })
      .strict(),
    prompt:
      "원국 전체를 한 줄 헤드라인과 3~4문장 요약으로 정리하고, 성향을 대표하는 키워드를 3~6개 뽑아라.",
  },

  personality: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    prompt:
      "타고난 성향을 서로 겹치지 않는 관점 2~4개로 나눠, 각각 제목과 2~4문장 본문으로 써라. 근거가 되는 십성·오행을 본문에 녹여라.",
  },

  outerVsInner: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({ outward: z.string().min(1), inner: z.string().min(1) })
      .strict(),
    prompt:
      "남에게 보이는 모습(outward)과 속마음(inner)의 차이를 각각 2~3문장으로 대비시켜 써라.",
  },

  strengths: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    prompt: "강점을 2~4개, 각각 제목과 1~2문장 본문으로 써라. 제목은 서술형 문장으로.",
  },

  cautions: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({ items: shortList(2, 4), tip: z.string().min(1) })
      .strict(),
    prompt:
      "주의할 점을 2~4개 각각 두세 문장으로 쓰고, 이를 보완할 실천 팁(tip)을 한 문단으로 덧붙여라.",
  },

  emotion: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt:
      "감정 패턴을 2~4개 항목으로 나눠라. label 은 상황(예: 스트레스가 쌓이는 상황), body 는 그 상황에서의 반응을 2~3문장으로.",
  },

  relating: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(KeyValue).min(3).max(6),
    prompt:
      "관계를 맺는 방식을 3~6개 항목으로 정리하라. label 은 관점, value 는 한 문장 이내의 짧은 값.",
  },

  love: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt: "연애에서의 성향을 2~4개 항목으로. label 은 국면, body 는 2~3문장.",
  },

  compatibility: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z
      .object({ good: shortList(2, 4), clash: shortList(2, 4) })
      .strict(),
    prompt:
      "잘 맞는 상대 유형(good)과 부딪히기 쉬운 유형(clash)을 각각 2~4개, 한 문장씩 써라.",
  },

  wealth: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z
      .object({
        points: z.array(LabeledText).min(2).max(4),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
      })
      .strict(),
    prompt:
      "재물 성향을 points 2~4개(label + 2~3문장 body)로 쓰고, 전체 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
  },

  yearlyLuck: {
    version: 1,
    tier: "paid",
    storage: "luck",
    schema: z.array(TimelineNote).min(1).max(12),
    prompt:
      "주어진 연도 목록과 같은 개수·같은 순서로, 각 해의 제목(title)과 설명(desc)을 써라. 연도 표기는 넣지 마라 — 계산된 값을 따로 붙인다.",
  },

  daeunOutlook: {
    version: 1,
    tier: "paid",
    storage: "luck",
    schema: z
      .object({
        rows: z.array(TimelineNote).min(1).max(12),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
      })
      .strict(),
    prompt:
      "주어진 대운 목록과 같은 개수·같은 순서로 rows 를 쓰고(연령대 표기는 넣지 마라 — 계산된 값을 따로 붙인다), 전체 흐름 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
  },
} as const satisfies Record<string, SectionSpec>;
