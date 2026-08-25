import { z } from "zod";
import { LabeledText, TitledText } from "@/app/api/saju/_lib/sections/primitives";
import type { VariantSectionKey } from "@/lib/matches/relation-copy";

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
  /**
   * 이 콜에 실을 관계 유형별 관점 블록 (relation-copy.ts).
   *
   * 콜 하나가 화면 두 개를 만드는 섹션이 있어 배열이다 — together 는 06·07 을
   * 함께 쓰므로 presence·continuity 두 블록을 다 받는다. 빈 배열이면 블록 자체를
   * 넣지 않는다 (기획안 §17 의 "영향을 적게 받는 섹션").
   */
  variants: readonly VariantSectionKey[];
  schema: z.ZodType;
  prompt: string;
  /**
   * 문체를 잡아주는 짧은 예시.
   * ⚠️ 예시도 SYSTEM_PROMPT 규칙을 지켜야 한다 — 숫자를 쓰면 "쓰지 말라" 는
   * 규칙보다 예시가 이긴다.
   */
  example: string;
}

/**
 * 궁합 서술 섹션. section_key = 이 객체의 키.
 *
 * ⚠️ 키는 **콜 단위**이고 화면 섹션은 그보다 잘다 — 일곱 콜이 열 개의 화면을 만든다.
 * bond 가 04·05 를, together 가 06·07 을, conflict 가 08·09 를 한 응답에 담는다.
 *
 * 그렇게 묶은 이유가 이 파일에서 가장 중요한 결정이다. 기획안 §15 가 "혼동하면 안
 * 된다"고 지목한 세 쌍을 각각 한 스키마의 형제 필드로 만들면, 모델이 toMe 를 쓴 뒤
 * 같은 응답에서 changeInMe 를 쓴다 — 중복 방지가 프롬프트 부탁이 아니라 눈앞에
 * 보이는 구조가 된다. 나누면 원가도 두 배가 된다.
 *
 * 최소 개수는 기획안 권장치보다 하나 낮다. 모델이 권장치를 못 채우면
 * parseMatchSectionContent 가 섹션을 통째로 버려 화면에서 사라지기 때문이다 —
 * 검증은 "쓸 수 없는 것"만 막고 개수 요구는 prompt 가 한다.
 */
export const MATCH_SECTIONS = {
  verdict: {
    version: 2,
    variants: [],
    schema: z.object({ headline: z.string().min(1), summary: z.string().min(1) }).strict(),
    prompt: [
      "두 사람이 만났을 때 생기는 성질을 한 줄 헤드라인(headline)과 서너 문장 요약(summary)으로 정리하라.",
      "관계의 가장 큰 특징, 서로에게 도움이 되는 부분, 대표적인 긴장이나 차이를 담아라.",
      "누가 더 낫다는 식으로 쓰지 말고, 이 조합에서만 생기는 성질을 짚어라.",
      "잘 맞는다/안 맞는다로 결론 내지 마라 — 어떻게 맞물리는지를 써라.",
      "뒤에서 자세히 다룰 행동 패턴까지 여기서 다 소비하지 마라. 총평은 먼저 조망하는 자리다.",
    ].join("\n"),
    example:
      '{"headline":"속도가 다른 두 사람, 그래서 서로의 브레이크이자 엑셀","summary":"한쪽이 먼저 움직이고 다른 쪽이 뒤에서 정리하는 흐름이 자연스럽게 만들어져요. 급할 때는 이 차이가 답답하게 느껴지지만, 큰 결정 앞에서는 서로가 서로의 안전장치가 돼요."}',
  },

  chemistry: {
    version: 2,
    variants: [],
    schema: z
      .object({
        pull: z.array(TitledText).min(2).max(4),
        friction: z.array(TitledText).min(2).max(4),
      })
      .strict(),
    // 한 콜에 둘을 같이 쓰게 하는 것이 요점이다. 따로 뽑으면 "잘 맞는 점" 과
    // "안 맞는 점" 이 서로 다른 이야기를 하는 두 편의 글이 된다.
    prompt: [
      "끌리는 지점(pull)과 부딪히는 지점(friction)을 각각 서너 개, 제목과 한두 문장 본문으로 써라.",
      "여기서 끌린다는 것은 연애적인 끌림이 아니라 두 사람 사이에 자연스럽게 생기는 호흡과 작용이다.",
      "같은 성질이 상황에 따라 양쪽에 다 나타날 수 있다 — 그런 경우라면 두 항목이 서로를 비추도록 써라.",
      "제목은 서술형 문장으로 쓴다.",
    ].join("\n"),
    example:
      '{"pull":[{"title":"말하지 않아도 상황을 먼저 읽어 줘요","body":"설명을 길게 하지 않아도 통하는 순간이 자주 있어요."}],"friction":[{"title":"같은 침묵을 서로 다르게 읽어요","body":"한쪽은 배려로 두는 시간을, 다른 쪽은 거리를 두는 신호로 받아들여요."}]}',
  },

  closeness: {
    version: 1,
    variants: ["closeness"],
    schema: z.array(LabeledText).min(2).max(5),
    prompt: [
      "두 사람 사이에 신뢰와 친밀감이 만들어지는 방식을 서너 개에서 다섯 개 써라.",
      "label 은 그 계기나 국면, body 는 그때 실제로 벌어지는 일을 두세 문장으로.",
      "위 [이 관계에서 볼 장면] 의 항목을 그대로 label 로 베끼지 말고, 이 두 사람에게서 나온 말로 다시 써라.",
      "누가 먼저 움직이는지처럼 방향이 있는 것은 방향까지 밝혀라.",
    ].join("\n"),
    example:
      '[{"label":"설명을 요구받지 않을 때","body":"묻지 않고 기다려 주는 시간이 길수록 먼저 입을 여는 쪽이에요. 재촉이 들어오면 오히려 말문이 닫혀요."}]',
  },

  bond: {
    version: 1,
    variants: [],
    schema: z
      .object({
        toMe: z.string().min(1),
        toYou: z.string().min(1),
        changeInMe: z.string().min(1),
        changeInYou: z.string().min(1),
        changeBetween: z.string().min(1),
      })
      .strict(),
    // 앞의 둘(지금의 자리)과 뒤의 셋(시간이 지나며 생기는 변화)을 한 응답에 담는 것이
    // 요점이다. 기획안 §15 가 이 둘을 "혼동하면 안 되는 영역" 으로 지목했는데, 따로
    // 뽑으면 같은 말을 시제만 바꿔 두 번 쓴다.
    prompt: [
      "다섯 문단을 쓴다. 앞의 둘은 지금의 자리, 뒤의 셋은 시간이 지나며 생기는 변화다. 이 경계를 넘지 마라.",
      "- toMe: 나에게 이 사람이 어떤 자리인지. 무엇을 채워 주고 무엇을 요구하는지. 서너 문장.",
      "- toYou: 이 사람에게 내가 어떤 자리인지. 같은 관계라도 반대편에서는 다르게 보인다는 것이 드러나야 한다. 서너 문장.",
      "- changeInMe: 이 관계를 이어가면서 나에게 나타나는 변화. 두세 문장.",
      "- changeInYou: 이 관계를 이어가면서 상대에게 나타나는 변화. 두세 문장.",
      "- changeBetween: 시간이 지나며 관계 자체의 성격이 달라지는 방향. 두세 문장.",
      "toMe·toYou 는 서로 거울처럼 대응하되 같은 말을 뒤집기만 하지는 마라.",
      "앞의 두 문단에서 이미 쓴 말을 뒤의 세 문단에서 다시 쓰지 마라. 자리는 지금이고 변화는 나중이다.",
      "변화는 단정하지 말고 경향으로 써라.",
    ].join("\n"),
    example:
      '{"toMe":"내가 미뤄 두던 결정을 대신 꺼내 놓는 사람이에요. 편하지만은 않은 자리라, 만나고 나면 생각이 정리되는 대신 조금 지치기도 해요.","toYou":"이 사람에게는 마음 놓고 속도를 늦출 수 있는 자리예요. 밖에서 팽팽하게 서 있던 힘을 여기서만 내려놓는 편이에요.","changeInMe":"이 사람과 오래 지낼수록 내 기준을 더 분명하게 세우게 되는 쪽으로 작용해요. 미루던 말을 그때그때 꺼내는 연습이 되기도 해요.","changeInYou":"상대는 혼자 감당하던 것을 조금씩 나누는 법을 익히게 되기 쉬워요.","changeBetween":"처음의 팽팽함이 옅어지는 대신, 서로 확인하지 않아도 되는 영역이 조금씩 넓어지는 방향으로 흘러요."}',
  },

  together: {
    version: 1,
    // 순서가 뜻을 가진다 — prompt 의 "앞의 것이 now, 뒤의 것이 later" 가 이 배열
    // 순서로 만들어지는 관점 블록 순서를 가리킨다. 임의로 바꾸면 안 된다.
    variants: ["presence", "continuity"],
    schema: z
      .object({
        now: z.array(LabeledText).min(2).max(5),
        later: z.array(LabeledText).min(2).max(5),
      })
      .strict(),
    prompt: [
      "두 묶음을 쓴다.",
      "- now: 지금 두 사람을 한 장면에 놓았을 때 나타나는 상호작용. 서너 개에서 다섯 개.",
      "- later: 관계가 오래 이어질 때 현실적으로 만들어지는 역할·기대·책임·거리의 구조. 서너 개에서 다섯 개.",
      "각 항목은 label(그 장면 또는 구조)과 body(두세 문장).",
      "위 [이 관계에서 볼 장면] 블록이 둘 있다 — 앞의 것이 now, 뒤의 것이 later 에 대응한다.",
      "now 는 눈앞의 장면이고 later 는 굳어진 구조다. 같은 이야기를 시제만 바꿔 두 번 쓰지 마라.",
      "later 는 미래를 단정하지 말고 경향으로 써라.",
    ].join("\n"),
    example:
      '{"now":[{"label":"약속을 정할 때","body":"한쪽이 먼저 날짜를 꺼내고 다른 쪽이 조정하는 흐름이 반복돼요. 정하는 사람이 늘 같아지면 정하는 쪽이 먼저 지쳐요."}],"later":[{"label":"자연스럽게 굳어지는 역할","body":"챙기는 자리와 따라가는 자리가 굳어지기 쉬워요. 굳어진 뒤에는 바꾸자는 말 자체가 큰 이야기처럼 느껴질 수 있어요."}]}',
  },

  conflict: {
    version: 1,
    variants: ["recovery"],
    schema: z
      .object({
        // conflict 는 08·09 를 함께 담은 묶음 콜이라 triggers 검증 실패가 두 화면을
        // 통째로 날린다(옛 ungrouped moments 는 한 화면만 잃었다). 넷을 받아도 손해가
        // 없고 넷을 버려서 잃는 게 더 크므로 max 를 올려 받는다. min 은 그대로 2 —
        // 국면 하나짜리는 부족이 아니라 깨진 콘텐츠로 읽힌다.
        triggers: z.array(LabeledText).min(2).max(4),
        onset: z.string().min(1),
        escalation: z.string().min(1),
        recovery: z.string().min(1),
        blindSpot: z.string().min(1),
      })
      .strict(),
    // 계기(triggers)와 그 다음(나머지 넷)을 한 응답에 담는다. 따로 뽑으면 뒤쪽 글이
    // 계기를 처음부터 다시 설명하며 시작한다.
    prompt: [
      "갈등의 계기와 그 다음을 한 번에 쓴다.",
      "- triggers: 관계가 흔들리기 쉬운 국면 두세 개. label 은 그 국면, body 는 그때 실제로 벌어지는 일을 두세 문장으로.",
      "- onset: 갈등이 시작되면 각자가 어떻게 반응하는지. 두세 문장.",
      "- escalation: 감정이 커졌을 때 나타나는 두 사람의 반응 차이. 두세 문장.",
      "- recovery: 관계를 다시 맞춰 갈 때 무엇이 필요한지. 바로 이야기해야 하는지, 시간이 필요한지, 행동으로 푸는지, 분명한 설명이 필요한지. 두세 문장.",
      "- blindSpot: 한쪽에게는 끝난 일이 다른 쪽에는 남아 있는 식의 온도 차이. 두세 문장.",
      "triggers 는 갈등이 왜 시작되는가고 나머지 넷은 시작된 다음의 이야기다. 계기를 뒤에서 다시 설명하지 마라.",
      "미래를 단정하지 말고 경향으로 써라.",
    ].join("\n"),
    example:
      '{"triggers":[{"label":"한쪽이 바빠질 때","body":"연락의 간격이 벌어지면 서로 다른 결론을 냅니다. 한쪽은 지금은 그럴 때라 넘기고, 다른 쪽은 멀어지는 신호로 읽기 쉬워요."}],"onset":"한쪽은 그 자리에서 짚고 넘어가려 하고, 다른 쪽은 일단 말을 줄이는 쪽으로 물러서요.","escalation":"목소리가 커지는 대신 대화가 짧아지는 형태로 커져요. 물러선 쪽은 정리할 시간을 벌고 있는데, 짚으려던 쪽에는 무시로 읽혀요.","recovery":"먼저 말을 꺼내는 쪽이 늘 같은 사람이 되기 쉬워요. 사과보다 무엇이 서운했는지를 한 문장으로 옮겨 주는 편이 빠르게 풀려요.","blindSpot":"한쪽은 이야기를 끝낸 시점에 상황이 정리됐다고 보는데, 다른 쪽은 감정이 가라앉는 데 시간이 더 걸려요."}',
  },

  advice: {
    version: 1,
    variants: ["advice"],
    schema: z
      .object({ items: z.array(TitledText).min(2).max(4), first: z.string().min(1) })
      .strict(),
    prompt: [
      "이 관계를 더 편하게 만드는 행동을 서너 개 써라.",
      "title 은 그 조언 자체를 그대로 쓴다 — 실천 하나, 실천 둘 같은 번호 라벨을 쓰지 마라.",
      "위 [이 관계에서 볼 장면] 의 항목을 그대로 title 로 베끼지 마라. 그 자리들을 이 두 사람의 사정으로 다시 옮겨 써라.",
      "title 은 행동을 가리키는 짧은 문장으로, body 는 왜 그것이 이 두 사람에게 필요한지를 한두 문장으로.",
      "마음가짐이 아니라 알아볼 수 있는 행동으로 쓴다.",
      "이어서 지금 가장 먼저 해볼 것 하나를 first 에 한 문단으로 덧붙여라.",
    ].join("\n"),
    example:
      '{"items":[{"title":"결정을 미룰 때는 미룬다고 말해 두기","body":"침묵이 거절로 읽히는 걸 막아 줘요. 기다리는 쪽의 짐작이 관계를 깎는 자리라서요."}],"first":"서로의 속도가 다르다는 걸 탓하지 말고, 언제까지 답을 줄지만 정해 보세요. 기다리는 쪽이 훨씬 편해져요."}',
  },
} as const satisfies Record<string, MatchSectionSpec>;
