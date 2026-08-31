// 상담이 읽을 "요즘 흐름" 블록 — 대운 · 세운 · 월운.
//
// `대화 설계 §N` = docs/superpowers/specs/2026-08-31-consultation-dialogue-design.md
//
// 원국(chartFacts)이 "원래 어떤 방식으로 반응하는 사람인가" 를 답한다면 이 블록은
// "왜 요즘 이게 더 두드러지는가"(대운·세운)와 "왜 하필 지금인가"(월운)를 답한다.
// 대화 설계 §12 가 일반 AI 상담과의 차이로 꼽은 자리다 — 원국만 보면 상담사가 몇 년째
// 같은 말을 하게 되고, 사용자는 지금의 어려움을 평생 가는 것으로 읽는다.
//
// ⚠️ 나이를 적지 않는다.
//   "36세부터" 는 지금 연도에서 빼면 곧 출생 연도라, 사실 블록에 개인정보를 넣지
//   않는다는 규칙(facts.ts)이 뒷문으로 뚫린다. 대운 안의 위치는 "10년 중 중반" 이면
//   충분하다 — 상담사가 알아야 하는 것은 나이가 아니라 이 배경이 언제 바뀌느냐다.
//
// ⚠️ 시각을 인자로 받는다.
//   `new Date()` 를 여기서 부르면 테스트가 오늘 날짜에 따라 깨지고, 무엇보다
//   같은 상담의 두 턴이 자정을 사이에 두면 사실 블록이 달라져 prefix 캐시가
//   깨진다(prompt.ts 의 캐시 경계 주석 참고). 호출자가 한 번 정해 넘긴다.

import {
  BRANCHES,
  STEMS,
  flowYearAt,
  isBranch,
  isStem,
  monthTermsOf,
  sewunPillars,
  tenGod,
  type DaeunPeriod,
  type SajuAnalysis,
  type Stem,
} from "@/lib/saju-core";
// 배럴은 birthInstant 만 내보낸다 — YEAR_MS 는 대운 회차를 flows 쪽 currentDaeun 과
// **같은 자**로 재기 위해 소스에서 직접 가져온다. 두 화면이 서로 다른 회차를 고르면
// 같은 사람에게 상담과 흐름이 다른 배경을 말한다.
import { birthInstant, YEAR_MS } from "@/lib/saju-core/flow/switch";

/** 대운 10년 안에서의 위치. 경계 4/7 은 flows 의 daeunPhaseOf 와 같은 값을 쓴다 */
export type DaeunPhase = "초반" | "중반" | "후반";

/**
 * 이 순간에 적용 중인 대운과, 그 10년 안에서의 위치.
 *
 * flows 의 `currentDaeun` 은 **명리 연도 구간**으로 묻는다. 상담은 연도가 아니라
 * 지금 이 순간으로 물어야 한다 — 대운이 올해 안에서 바뀌었다면 상담사는 바뀐 뒤를
 * 봐야 하는데, 구간 시작으로 고르면 바뀌기 전을 본다. 그래서 같은 식
 * (birth + (startAgePrecise + i×10) × YEAR_MS) 을 쓰되 기준만 순간으로 바꾼다.
 */
export function daeunAt(
  analysis: SajuAnalysis,
  at: Date,
): { period: DaeunPeriod; phase: DaeunPhase } {
  const { startAgePrecise, periods } = analysis.daeun;
  const birth = birthInstant(analysis).getTime();
  const target = at.getTime();

  let index = 0;
  for (let i = 1; i < periods.length; i += 1) {
    if (birth + (startAgePrecise + i * 10) * YEAR_MS > target) break;
    index = i;
  }

  const start = birth + (startAgePrecise + index * 10) * YEAR_MS;
  // 첫 대운이 들기 전(어린 나이)이면 음수가 된다 — 0 으로 눌러 "초반" 으로 읽는다.
  const elapsed = Math.min(Math.max((target - start) / YEAR_MS, 0), 9.999);

  return {
    period: periods[index],
    phase: elapsed < 4 ? "초반" : elapsed < 7 ? "중반" : "후반",
  };
}

/**
 * 간지 두 글자를 일간 기준 십성으로 읽는다. 읽을 수 없으면 null.
 *
 * 지지는 본기(正氣) 천간의 오행·음양으로 판정한다 — ten-gods.ts 의 branchEY 와
 * 같은 규칙이다. 여기서만 지지 자체 음양을 쓰면 원국 블록과 흐름 블록이 같은
 * 글자를 다른 십성으로 불러, 상담사가 읽는 두 줄이 서로 어긋난다.
 */
export function pillarTenGods(dayMaster: Stem, korean: string): string | null {
  const [s, b] = Array.from(korean);
  if (!s || !b || !isStem(s) || !isBranch(b)) return null;

  const ey = (stem: Stem) => ({ element: STEMS[stem].element, yinYang: STEMS[stem].yinYang });
  const day = ey(dayMaster);

  return `천간 ${s} ${tenGod(day, ey(s))} · 지지 ${b} ${tenGod(day, ey(BRANCHES[b].mainStem))}`;
}

/**
 * [사실 · 요즘 흐름] 블록.
 *
 * 던지지 않는다 — 만세력 범위(1900~2050) 밖이거나 절기 계산이 실패하면 null 이다.
 * 흐름 세 줄 때문에 상담 전체가 열리지 않으면 안 된다. 그때 상담사는 원국만 들고
 * 답하는데, 그건 이 기능이 있기 전의 상태와 같다.
 */
export function luckFacts(analysis: SajuAnalysis, at: Date): string | null {
  try {
    const dayMaster = analysis.chart.dayMaster;
    const flowYear = flowYearAt(at).year;
    const { period, phase } = daeunAt(analysis, at);
    const sewun = sewunPillars(flowYear, 1)[0];
    // 명리 달이다 — 달력 달이 아니라 절기 구간이다. 경계를 벗어나는 일은 없지만
    // (flowYearAt 이 고른 해의 12구간이 그 해를 빈틈없이 덮는다) 방어로 마지막을 둔다.
    const terms = monthTermsOf(flowYear);
    const month =
      terms.find((t) => at >= t.start && at < t.end) ?? terms[terms.length - 1];

    const line = (label: string, korean: string, tail = "") => {
      const gods = pillarTenGods(dayMaster, korean);
      return `${label}: ${korean}${gods ? ` — ${gods}` : ""}${tail}`;
    };

    return [
      "[사실 · 요즘 흐름]",
      // 첫 줄이 대화 설계 §16 의 핵심이다. 라벨만 바꿔 붙이면 모델이 원국과 흐름을
      // 한 문장에 섞어, 지나가는 것을 타고난 것처럼 말한다.
      "※ 아래는 타고난 성향이 아니라 지금 지나는 흐름이다. 원국과 섞어 말하지 마라.",
      // 둘째 줄은 §9 다. 이 줄이 없으면 "이번 달 재물의 힘이 강하게 들어와 있어서
      // 술을 더 찾게 되는 시기예요" 같은 문장이 나온다 — 흐름은 시기의 렌즈이지
      // 지금 겪는 일의 원인이 아니다. 원하는 것은 "원래의 패턴과 견주면 지금은 그
      // 성향이 조금 더 두드러질 수 있는 때로 읽혀요" 정도다.
      "※ 흐름은 고민의 원인을 단정하는 근거가 아니다. 상대가 말한 지금 상태와 이어 읽을 수는 있어도, 몸·감정·행동의 변화가 이 흐름 때문에 생겼다고 말하지 마라.",
      line("현재 대운(수년간 이어지는 배경)", period.pillar, ` (10년 중 ${phase})`),
      line("올해 세운", sewun.korean),
      line(`이번 달 월운(${month.name} 구간)`, month.korean),
    ].join("\n");
  } catch (e) {
    console.error("[consult] luckFacts", e instanceof Error ? e.message : e);
    return null;
  }
}
