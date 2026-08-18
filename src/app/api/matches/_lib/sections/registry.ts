import { z } from "zod";
import { LabeledText, TitledText } from "@/app/api/saju/_lib/sections/primitives";

export interface MatchSectionSpec {
  /**
   * 이 섹션 스키마의 버전. match_sections.schema_version 에 기록된다.
   * shape 을 바꿀 때만이 아니라 프롬프트 의미가 바뀌었을 때도 올린다 — 저장된
   * 서술은 이 값이 다를 때만 다시 생성된다.
   *
   * ⚠️ 리포트와 달리 재생성이 곧 이용권 원가다. 버전을 올리면 기존 궁합 전부가
   * 다음 열람에서 다시 생성된다. 올리기 전에 비용을 계산할 것.
   */
  version: number;
  schema: z.ZodType;
  prompt: string;
  /**
   * 문체를 잡아주는 짧은 예시.
   * ⚠️ 예시도 SYSTEM_PROMPT 규칙을 지켜야 한다 — 숫자를 쓰면 "쓰지 말라" 는
   * 규칙보다 예시가 이긴다.
   */
  example: string;
}

const shortList = (min: number, max: number) => z.array(z.string().min(1)).min(min).max(max);

/**
 * 궁합 서술 섹션. section_key = 이 객체의 키.
 *
 * 리포트의 SECTIONS 와 나란한 구조지만 tier·storage 가 없다 — 무료/유료로 갈리지
 * 않고 저장소가 하나다.
 */
export const MATCH_SECTIONS = {
  verdict: {
    version: 1,
    schema: z.object({ headline: z.string().min(1), summary: z.string().min(1) }).strict(),
    prompt: [
      "두 사람이 만났을 때 생기는 성질을 한 줄 헤드라인(headline)과 3~4문장 요약(summary)으로 정리하라.",
      "누가 더 낫다는 식으로 쓰지 말고, 이 조합에서만 생기는 성질을 짚어라.",
      "잘 맞는다/안 맞는다로 결론 내지 마라 — 어떻게 맞물리는지를 써라.",
    ].join("\n"),
    example:
      '{"headline":"속도가 다른 두 사람, 그래서 서로의 브레이크이자 엑셀","summary":"한쪽이 먼저 움직이고 다른 쪽이 뒤에서 정리하는 흐름이 자연스럽게 만들어져요. 급할 때는 이 차이가 답답하게 느껴지지만, 큰 결정 앞에서는 서로가 서로의 안전장치가 돼요."}',
  },

  chemistry: {
    version: 1,
    schema: z
      .object({
        pull: z.array(TitledText).min(2).max(4),
        friction: z.array(TitledText).min(2).max(4),
      })
      .strict(),
    // 한 콜에 둘을 같이 쓰게 하는 것이 요점이다. 따로 뽑으면 "잘 맞는 점" 과
    // "안 맞는 점" 이 서로 다른 이야기를 하는 두 편의 글이 된다.
    prompt: [
      "끌리는 지점(pull)과 부딪히는 지점(friction)을 각각 2~4개, 제목과 1~2문장 본문으로 써라.",
      "같은 성질이 상황에 따라 양쪽에 다 나타날 수 있다 — 그런 경우라면 두 항목이 서로를 비추도록 써라.",
      "제목은 서술형 문장으로 쓴다.",
    ].join("\n"),
    example:
      '{"pull":[{"title":"말하지 않아도 상황을 먼저 읽어 줘요","body":"설명을 길게 하지 않아도 통하는 순간이 자주 있어요."}],"friction":[{"title":"같은 침묵을 서로 다르게 읽어요","body":"한쪽은 배려로 두는 시간을, 다른 쪽은 거리를 두는 신호로 받아들여요."}]}',
  },

  eachSide: {
    version: 1,
    schema: z.object({ toMe: z.string().min(1), toYou: z.string().min(1) }).strict(),
    // 이 섹션이 리포트의 compatibility(잘 맞는 "유형" 일반론)와 갈리는 자리다.
    // 방향이 있는 서술은 특정 상대가 있어야만 쓸 수 있다.
    prompt: [
      "관계의 방향을 나눠 써라. 각각 3~4문장.",
      "- toMe: 나에게 이 사람이 어떤 자리인지. 무엇을 채워 주고 무엇을 요구하는지.",
      "- toYou: 이 사람에게 내가 어떤 자리인지. 같은 관계라도 반대편에서는 다르게 보인다는 것이 드러나야 한다.",
      "두 문단이 서로 거울처럼 대응하되 같은 말을 뒤집기만 하지는 마라.",
    ].join("\n"),
    example:
      '{"toMe":"내가 미뤄 두던 결정을 대신 꺼내 놓는 사람이에요. 편하지만은 않은 자리라, 만나고 나면 생각이 정리되는 대신 조금 지치기도 해요.","toYou":"이 사람에게는 마음 놓고 속도를 늦출 수 있는 자리예요. 밖에서 팽팽하게 서 있던 힘을 여기서만 내려놓는 편이에요."}',
  },

  moments: {
    version: 1,
    schema: z.array(LabeledText).min(2).max(3),
    prompt: [
      "관계가 흔들리기 쉬운 국면을 2~3개 써라.",
      "label 은 그 국면(예: 한쪽이 바빠질 때), body 는 그때 실제로 벌어지는 일을 2~3문장으로.",
      "미래를 단정하지 말고 경향으로 써라.",
    ].join("\n"),
    example:
      '[{"label":"한쪽이 바빠질 때","body":"연락의 간격이 벌어지면 서로 다른 결론을 냅니다. 한쪽은 지금은 그럴 때라 넘기고, 다른 쪽은 마음이 식었다고 읽기 쉬워요."}]',
  },

  bridge: {
    version: 1,
    schema: z.object({ items: shortList(2, 3), tip: z.string().min(1) }).strict(),
    prompt: [
      "이 관계를 낫게 만드는 실천을 2~3개(items), 각각 한두 문장으로 써라.",
      "마음가짐이 아니라 알아볼 수 있는 행동으로 쓴다.",
      "이어서 그중 가장 먼저 해볼 것을 한 문단(tip)으로 덧붙여라.",
    ].join("\n"),
    example:
      '{"items":["결정을 미룰 때는 미룬다고 말해 두세요. 침묵이 거절로 읽히는 걸 막아 줘요."],"tip":"서로의 속도가 다르다는 걸 탓하지 말고, 언제까지 답을 줄지만 정해 보세요. 기다리는 쪽이 훨씬 편해져요."}',
  },
} as const satisfies Record<string, MatchSectionSpec>;
