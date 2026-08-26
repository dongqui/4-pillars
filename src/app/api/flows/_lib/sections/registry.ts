import { z } from "zod";
import { SEGMENT_IDS, type SegmentId } from "../segments";

export interface FlowSegmentBody {
  segmentId: SegmentId;
  title: string;
  body: string;
}

/** 01~06·08 — 연간 배경 + 구간별 서술 */
export interface SegmentedContent {
  /** 그해 전체의 배경. 구간이 하나여도 segments 와 역할이 달라 중복이 아니다 */
  common: string;
  segments: FlowSegmentBody[];
}

/** 07 — 타임라인 그 자체. 배경 문단이 따로 없다 */
export interface TimelineContent {
  segments: FlowSegmentBody[];
}

export interface FlowSectionSpec {
  /**
   * 이 섹션 스키마의 버전. flow_sections.schema_version 에 기록된다.
   * shape 을 바꿀 때만이 아니라 프롬프트 의미가 바뀌었을 때도 올린다.
   *
   * ⚠️ 리포트와 달리 재생성이 곧 이용권 원가다. 버전을 올리면 이미 판 흐름 전부가
   * 다음 열람에서 다시 생성된다. 올리기 전에 비용을 계산할 것.
   */
  version: number;
  /**
   * content 의 유일한 shape 정의.
   *
   * 리포트·궁합과 달리 **상수가 아니라 팩토리**다 — 구간 수 n 이 프로필마다 다르고,
   * 그 n 이 검증에도 걸려야 segmentId enum 이 의미를 갖기 때문이다.
   */
  schema: (n: number) => z.ZodType;
  /** 이 섹션만 재생성할 때 LLM 에 줄 지시문 */
  prompt: string;
  /**
   * 문체를 잡아주는 짧은 예시.
   * ⚠️ 예시도 FLOW_SYSTEM_PROMPT 규칙을 지켜야 한다 — 연도·월·날짜를 쓰면
   * "쓰지 말라" 는 규칙보다 예시가 이긴다.
   */
  example: string;
}

/**
 * 구간 하나. segmentId 를 z.enum 으로 좁히는 것이 요점이다 —
 * 자유 문자열로 받으면 LLM 이 쓴 id 는 LLM 이 쓴 순서보다 더 믿을 만하지 않아서
 * 검증할 수 없는 값이 하나 늘 뿐이다.
 */
const segmentBody = (n: number) =>
  z
    .object({
      segmentId: z.enum(SEGMENT_IDS.slice(0, n) as [SegmentId, ...SegmentId[]]),
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .strict();

/**
 * 개수 n + id 가 그 n개 중 하나 + id 중복 없음 → **집합이 정확히 일치한다**.
 * 셋 중 하나만 빠져도 "개수는 맞는데 한 칸이 비고 다른 칸이 두 번" 이 통과한다.
 */
const segmentList = (n: number) =>
  z
    .array(segmentBody(n))
    .length(n)
    .superRefine((arr, ctx) => {
      if (new Set(arr.map((s) => s.segmentId)).size !== arr.length) {
        ctx.addIssue({ code: "custom", message: "segmentId 가 중복되었습니다" });
      }
    });

const segmented = (n: number) =>
  z.object({ common: z.string().min(1), segments: segmentList(n) }).strict();

const timeline = (n: number) => z.object({ segments: segmentList(n) }).strict();

const SEGMENT_RULE =
  "구간마다 하나씩, 계산된 구간 수와 같은 개수로 써라. segmentId 는 주어진 값만 쓴다. " +
  "각 구간에 '원래는 …지만 지금은 …' 같은 대비를 최소 한 번 넣어라. " +
  "연도·월·날짜·기간을 지어내지 마라 — 시간 표시는 계산된 값이 화면에서 붙는다.";

/**
 * 흐름 서술 섹션. section_key = 이 객체의 키.
 *
 * 리포트의 SECTIONS 와 나란한 구조지만 tier·storage 가 없다 — 무료/유료로 갈리지
 * 않고 저장소가 하나다. (궁합의 MATCH_SECTIONS 와 같다)
 */
export const FLOW_SECTIONS = {
  now: {
    version: 1,
    schema: segmented,
    prompt: [
      "01 지금의 흐름. common 에는 올해 전체의 성격을 3~4문장으로 쓴다.",
      "각 구간의 title 은 '지금 어떤 시기를 지나고 있는가' 를 한 줄로 압축한 대표 문장이다.",
      "body 는 지금 들어와 있는 흐름이 타고난 성향과 만나 무엇이 평소와 달라지는지 3~4문장.",
      "좋은 시기 / 나쁜 시기로 평가하지 마라 — 같은 흐름에 기회와 부담이 함께 있다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"올해는 안으로 쌓아온 것을 밖으로 꺼내는 힘이 커지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"오래 눌러두었던 것을 조금씩 밖으로 꺼내기 시작하는 때","body":"원래는 충분히 살핀 뒤 움직이는 편인데, 요즘은 생각이 끝나기 전에 먼저 해보고 싶은 마음이 평소보다 강해지기 쉬워요. 답답했던 일을 움직이기에는 힘이 생기지만, 동시에 너무 많은 일을 한꺼번에 벌이고 싶어질 수도 있어요."}]}',
  },

  rising: {
    version: 1,
    schema: segmented,
    prompt: [
      "02 지금 살아나는 것. 평소보다 자연스럽게 강해지거나 쓰기 쉬워지는 힘을 다룬다.",
      "타고난 강점을 다시 설명하지 마라 — '원래 잘하는 것' 이 아니라 '지금 평소보다 힘이 실리는 것' 이다.",
      "각 구간의 body 에 그런 힘을 2~3개 담되 목록이 아니라 이어지는 문장으로 쓴다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"올해는 결정을 미루지 않는 힘과 밖으로 꺼내는 힘이 함께 올라와요.","segments":[{"segmentId":"segment_1","title":"결정을 미루지 않는 힘","body":"평소에는 여러 가능성을 오래 살피는 편이지만, 지금은 어느 정도 판단이 서면 직접 움직여보려는 힘이 강해져요. 생각만 하던 것을 말이나 결과물로 보여주는 일도 조금 더 자연스러워지는 때예요."}]}',
  },

  straining: {
    version: 1,
    schema: segmented,
    prompt: [
      "03 지금 부담되는 것. 흐름과 타고난 성향이 만나 에너지가 쉽게 소진되는 지점을 다룬다.",
      "'조심하세요' 같은 경고가 아니다. 사용자가 '그래서 요즘 이게 유독 힘들었구나' 라고 이해하게 만드는 것이 목적이다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"밖에서 들어오는 요구가 늘면서 무엇을 내려놓을지가 중요해지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"해야 할 일이 자꾸 늘어날 때","body":"평소에도 부탁을 잘 못 넘기는 편인데, 요즘은 밖에서 들어오는 역할이 많아져 하나를 끝내기도 전에 다음 일을 붙잡게 될 수 있어요. 지금은 더 많이 잡는 것보다 무엇을 내려놓을지가 중요해져요."}]}',
  },

  work: {
    version: 1,
    schema: segmented,
    prompt: [
      "04 일과 선택. 일·공부·진로·개인 목표 등 무언가를 해내고 고르는 과정을 다룬다.",
      "특정 직업을 전제하지 마라. 퇴사·창업·이직을 권하거나 결과를 예언하지 마라.",
      "선택의 결과가 아니라 **판단의 기준**을 준다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"벌이기보다 고르는 일이 중요해지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"새로운 선택지가 눈에 들어올 때","body":"평소에는 하던 것을 다듬는 쪽이 편한데, 지금은 다른 길을 검토하려는 마음이 강해지기 쉬워요. 다만 지금의 답답함에서 벗어나고 싶은 것인지, 실제로 더 원하는 방향이 생긴 것인지는 구분해서 보는 게 좋아요."}]}',
  },

  relating: {
    version: 1,
    schema: segmented,
    prompt: [
      "05 관계. 연애만이 아니라 인간관계 전반을 다룬다.",
      "특정 인물이 나타난다고 예측하지 마라. 관계의 지속·이별·결혼을 예언하지 마라.",
      "'원래 사람을 어떻게 대하는가' 가 아니라 '요즘 무엇이 평소와 달라지는가' 를 쓴다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"사람에게 쓰는 에너지가 늘어나는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"먼저 살피는 성향이 더 세게 작동할 때","body":"평소에도 상대를 먼저 살피는 편인데, 요즘은 바깥에서 들어오는 부탁과 역할이 많아지면서 그 성향이 평소보다 더 강하게 작동하기 쉬워요. 혼자 감당하기보다 이미 가진 관계에 기대는 쪽이 지금 흐름과 잘 맞아요."}]}',
  },

  money: {
    version: 1,
    schema: segmented,
    prompt: [
      "06 돈과 현실. 돈이 들어올지 나갈지를 예측하지 말고, 돈·소비·성과를 대하는 **태도**가 어떻게 달라지기 쉬운지 쓴다.",
      "금지: 투자 종목 추천, 투자 시점 예측, 수익 보장, 부동산 매수/매도 지시, 큰돈이 들어온다는 단정, 복권·도박.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"크게 벌이는 것보다 이미 가진 것을 효율적으로 쓰는 것이 중요한 흐름이에요.","segments":[{"segmentId":"segment_1","title":"사람 때문에 나가는 돈이 늘 때","body":"평소에는 계획한 만큼 쓰는 편인데, 요즘은 사람과 자리에 얽힌 지출이 늘기 쉬워요. 불안해서 서둘러 결정하는 소비가 있는지 한 번 살펴볼 만한 때예요."}]}',
  },

  ahead: {
    version: 1,
    schema: timeline,
    prompt: [
      "07 앞으로의 변화. 각 구간이 어떤 흐름인지를 title 과 body 로 쓴다.",
      "common 은 없다 — 이 섹션이 구간 타임라인 그 자체다.",
      "**앞 구간과 무엇이 달라지는가** 를 반드시 쓴다. 각 구간을 독립적으로 소개하지 마라.",
      "구간이 하나뿐이면 올해는 흐름이 크게 갈리지 않는다는 것을 그대로 쓴다 — 없는 변화를 만들지 마라.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"segments":[{"segmentId":"segment_1","title":"밖으로 움직이는 흐름","body":"사람이나 일이 늘어나면서 가만히 있기보다 움직이고 시도하는 힘이 강해지는 구간이에요."},{"segmentId":"segment_2","title":"벌인 것을 정리하는 흐름","body":"앞에서 시작한 것을 다듬고 무엇을 남길지 고르는 일이 중요해져요. 앞 구간이 넓히는 때였다면 여기서는 좁히는 쪽으로 무게가 옮겨가요."}]}',
  },

  remember: {
    version: 1,
    schema: segmented,
    prompt: [
      "08 지금 기억할 것. 앞의 내용을 요약하지 말고, 이 흐름에서 가져갈 태도와 행동을 준다.",
      "각 구간의 body 에 실제로 해볼 수 있는 것 하나를 포함한다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"이 시기를 지나는 동안 무엇을 하지 않을지 정하는 것이 중요해요.","segments":[{"segmentId":"segment_1","title":"모든 기회를 잡으려고 하지 않기","body":"평소에는 기회를 놓치는 것이 더 아깝게 느껴졌겠지만, 지금은 바깥에서 들어오는 일이 많아질수록 무엇을 하지 않을지 정하는 것이 더 중요해요. 이번 주에 들어온 요청 하나를 골라 정중히 미뤄보세요."}]}',
  },
} as const satisfies Record<string, FlowSectionSpec>;
