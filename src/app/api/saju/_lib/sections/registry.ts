import { z } from "zod";
import { KeyValue, LabeledText, TimelineNote, TitledText, TraitNote } from "./primitives";

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
  /**
   * 문체를 잡아주는 짧은 예시(JSON 한 조각). 지시문과 같은 자리에 둬야
   * 섹션을 고칠 때 톤 예시도 같이 눈에 들어온다.
   *
   * ⚠️ 예시도 시스템 프롬프트 규칙을 지켜야 한다 — 숫자·연도·나이를 쓰면
   * "쓰지 말라"는 규칙보다 예시가 이긴다. 픽스처에서 옮겨올 때 숫자를 지웠다.
   */
  example: string;
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
    version: 2,
    tier: "free",
    storage: "chart",
    // traits 하나가 히어로 키워드 칩과 01 카드 양쪽을 채운다. 두 섹션으로
    // 나뉘어 있던 시절엔 호출이 따로 나가 칩과 카드가 어긋났다.
    schema: z
      .object({
        headline: z.string().min(1),
        summary: z.string().min(1),
        traits: z.array(TraitNote).length(4),
      })
      .strict(),
    // basis 는 사주 용어를 쓰는 유일한 자리다. 시스템 프롬프트의 "용어 금지"에
    // 대한 명시적 예외라, 이 지시문을 지우면 리포트 전체에서 용어가 사라진다.
    prompt: [
      "타고난 기질 전체를 한 줄 헤드라인(headline)과 3~4문장 요약(summary)으로 정리하고,",
      "성향을 대표하는 서로 겹치지 않는 관점 4개를 traits 로 써라. 각 trait 은 세 부분이다.",
      "- title: 그 관점을 한눈에 보여주는 짧은 말. 그대로 키워드로 노출되므로 사주 용어를 쓰지 말고, 성격을 바로 알아볼 수 있는 말로 짧게 쓴다.",
      "- body: 그 성향이 일상에서 어떻게 드러나는지 2~3문장. 여기서도 사주 용어를 쓰지 마라.",
      '- basis: 그 성향의 사주 근거 한 문장. 이 필드에서만 사주 용어를 써도 된다 — 일간·십성·오행을 자연스럽게 녹이되 나열하거나 강의하지 마라. body 뒤에 이어붙여 읽어도 말이 되도록 "~해서 그래요", "~라 그래요" 처럼 앞 문장을 받는 종결로 쓴다.',
    ].join("\n"),
    example:
      '{"headline":"겉으로는 차분하지만, 자신만의 기준과 승부욕이 강한 사람","summary":"사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입이에요.","traits":[{"title":"신중한 관찰자","body":"상황을 먼저 파악한 뒤 움직여요. 말보다 판단이 앞서는 이유예요.","basis":"일간 갑목이 인월의 단단한 뿌리 위에 서 있어서 그래요."}]}',
  },

  personality: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    // 사주 용어를 쓰는 유일한 섹션이다. 시스템 프롬프트의 "용어 금지"에 대한
    // 명시적 예외라, 이 문장을 지우면 이 섹션도 용어 없는 서술로 바뀐다.
    prompt:
      "타고난 성향을 서로 겹치지 않는 관점 2~4개로 나눠, 각각 제목과 2~4문장 본문으로 써라. 이 섹션에서만 사주 용어를 써도 된다 — 근거가 되는 일간·십성·오행을 본문에 한 번씩 자연스럽게 녹이되, 용어를 나열하거나 강의하지 마라.",
    example:
      '[{"title":"신중한 관찰자","body":"일간 갑목이 인월의 단단한 뿌리 위에 서 있어, 상황을 먼저 파악한 뒤 움직이는 힘이 강해요. 말보다 판단이 앞서는 이유예요."}]',
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
    example:
      '{"outward":"침착하고 단단한 사람. 감정 기복이 적고, 맡은 일은 조용히 끝까지 해내는 믿음직한 인상을 줘요.","inner":"관계와 선택을 오래 고민하는 편. 결정 전에 수많은 경우의 수를 혼자 돌려보느라, 겉보다 속이 훨씬 바빠요."}',
  },

  strengths: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    prompt: "강점을 2~4개, 각각 제목과 1~2문장 본문으로 써라. 제목은 서술형 문장으로.",
    example:
      "[{\"title\":\"복잡한 상황의 핵심을 빠르게 파악해요\",\"body\":\"회의가 산으로 갈 때 '그래서 결정할 건 이거죠'라고 정리하는 쪽이에요.\"}]",
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
    example:
      '{"items":["충분히 잘하고 있어도 스스로 만족하지 못할 수 있어요. 기준이 늘 자기 자신이라, 남의 인정이 와도 잘 안 쌓여요."],"tip":"완벽하게 정리된 뒤 말하려 하기보다, 생각이 절반쯤 정리됐을 때 먼저 표현해 보세요. 관계도 일도 훨씬 가벼워져요."}',
  },

  emotion: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt:
      "감정 패턴을 2~4개 항목으로 나눠라. label 은 상황(예: 스트레스가 쌓이는 상황), body 는 그 상황에서의 반응을 2~3문장으로.",
    example:
      '[{"label":"스트레스가 쌓이는 상황","body":"내 뜻대로 할 수 없는 상황이 계속될 때. 특히 결정권 없이 책임만 지는 구조에서 크게 소모돼요."}]',
  },

  relating: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(KeyValue).min(3).max(6),
    prompt:
      "관계를 맺는 방식을 3~6개 항목으로 정리하라. label 은 관점, value 는 한 문장 이내의 짧은 값.",
    example:
      '[{"label":"처음 만날 때","value":"거리를 두고 관찰부터. 먼저 다가가기보다 상대를 파악한 뒤 마음을 열어요."}]',
  },

  environment: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z
      .object({
        energizing: shortList(3, 4),
        draining: shortList(3, 4),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
      })
      .strict(),
    prompt:
      "능력이 잘 드러나는 조건을 두 갈래로 나눠라. energizing 은 힘이 나는 조건, draining 은 기운이 빠지는 조건을 각각 3~4개, 한 문장 이내의 짧은 구절로 쓴다. 성격 묘사가 아니라 일하는 방식·조직 문화·일정처럼 밖에서 알아볼 수 있는 조건으로 써라. 이어서 전체 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
    // emphasis 가 summary 안에 그대로 들어 있는 예시다 — 화면이 부분 문자열로 찾는다.
    example:
      '{"energizing":["방법은 맡기고 결과로 평가하는 팀"],"draining":["과정을 자주 보고해야 하는 관리 방식"],"summary":"정해진 방식만 반복하는 환경보다, 스스로 판단하고 개선할 여지가 있는 환경에서 능력이 잘 드러나요.","emphasis":"스스로 판단하고 개선할 여지가 있는 환경"}',
  },

  love: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt: "연애에서의 성향을 2~4개 항목으로. label 은 국면, body 는 2~3문장.",
    example:
      '[{"label":"관계가 시작될 때","body":"호감이 있어도 먼저 표현하지 않는 편. 상대가 다가와야 마음을 확인하고 움직여요."}]',
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
    example:
      '{"good":["말과 행동이 일치하고 약속을 지키는 사람"],"clash":["즉흥적으로 계획을 바꾸고 즉답을 요구하는 사람"]}',
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
    // emphasis 가 summary 안에 그대로 들어 있는 예시다 — 화면이 부분 문자열로 찾는다.
    example:
      '{"points":[{"label":"돈이 모이는 방식","body":"한 번에 크게 벌기보다 꾸준히 쌓는 구조가 맞아요. 전문성이 깊어질수록 수입이 계단식으로 올라가는 흐름이에요."}],"summary":"투자는 단기 매매보다 긴 호흡의 적립식이 타고난 성향과 잘 맞아요.","emphasis":"긴 호흡의 적립식"}',
  },

  yearlyLuck: {
    version: 1,
    tier: "paid",
    storage: "luck",
    schema: z.array(TimelineNote).min(1).max(12),
    prompt:
      "주어진 연도 목록과 같은 개수·같은 순서로, 각 해의 제목(title)과 설명(desc)을 써라. 연도 표기는 넣지 마라 — 계산된 값을 따로 붙인다. '세운'·'간지' 같은 용어 대신 '올해'·'이 시기'·'흐름' 처럼 풀어 쓴다.",
    example:
      '[{"title":"정리","desc":"미뤄둔 결정을 끝내기 좋은 흐름이에요. 새로 벌이기보다 마무리가 유리해요."}]',
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
      "주어진 대운 목록과 같은 개수·같은 순서로 rows 를 쓰고(연령대 표기는 넣지 마라 — 계산된 값을 따로 붙인다), 전체 흐름 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라. '대운'·'간지' 같은 용어 대신 '구간'·'시기'·'흐름' 처럼 풀어 쓴다.",
    example:
      '{"rows":[{"title":"기반을 쌓는 구간","desc":"실력과 신뢰를 축적하는 흐름이에요. 눈에 띄는 성과보다 토대가 만들어지는 시기예요."}],"summary":"지금은 기반을 쌓는 구간의 후반부예요. 앞으로의 선택이 다음 구간의 방향을 정해요.","emphasis":"기반을 쌓는 구간의 후반부"}',
  },
} as const satisfies Record<string, SectionSpec>;
