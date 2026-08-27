// 명리 연도 하나의 12개월을 채점한다.
//
// 앞선 설계는 이 12개를 "전환점을 고르기 위한 계산 해상도" 로만 썼다. 이제 12개가
// 그대로 노출 단위다(§17) — 그래서 두 축뿐 아니라 **서술의 재료**(관계 이름·십성
// 그룹)까지 함께 싣는다. 재료 없이 두 축만으로 12개 제목을 만들면 "받쳐주는 달 /
// 흔들리는 달" 이 여섯 번씩 반복된다.
//
// 변곡점 판정은 이 재료를 보지 않는다 — pivots.ts 가 support/friction 만 쓴다.

import {
  STEMS,
  branchElementOf,
  daeunSwitchIn,
  elementControls,
  elementGenerates,
  flowYearOf,
  generatedBy,
  monthTermsOf,
  sewunPillars,
  type Element,
  type FlowYearPeriod,
  type MonthTerm,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
// 배럴은 daeunSwitchIn 만 내보낸다 — currentDaeun 이 그와 "같은 자" 로 재야 해서
// birthInstant/YEAR_MS 는 소스 파일에서 직접 가져온다. (아래 currentDaeun 참고)
import { birthInstant, YEAR_MS } from "@/lib/saju-core/flow/switch";
import {
  frictionOf,
  parsePillar2,
  relationsOf,
  samhapGain,
  supportOf,
  type FrictionTargets,
  type Interaction,
} from "./score";

export interface MonthScore {
  /** 1‥12. 명리 연도 안에서의 순서다 — 달력 월이 아니다 */
  index: number;
  term: MonthTerm;
  support: number;
  friction: number;
  /** 이 달이 원국·세운·대운과 맺는 관계. 서술의 재료다 */
  interactions: Interaction[];
  /** 이 달이 들어와 삼합이 새로 완성되는가 */
  samhap: boolean;
  /** 이 달 간지의 천간·지지가 일간 대비 무슨 세력인가 */
  tenGods: TenGodGroup[];
}

/**
 * 이 구간이 시작될 때 적용 중인 대운.
 *
 * daeunSwitchIn 과 반드시 같은 정밀도로 재야 한다 — 반올림된 periods[i].startAge 로
 * 세는 나이를 근사하면 daeunSwitchIn 의 정밀 판정과 최대 반년 어긋날 수 있고,
 * 하필 그 어긋남이 경계에서 나면 이웃 회차를 조용히 골라 그 해 전체의 friction
 * 대상이 틀어진다. 그래서 daeunSwitchIn 과 같은 식
 * (birth + (startAgePrecise + i×10) × YEAR_MS) 으로, "이 구간 시작보다 이르거나
 * 같은 전환 중 가장 늦은 회차" 를 그대로 고른다.
 */
export function currentDaeun(analysis: SajuAnalysis, period: FlowYearPeriod) {
  const { startAgePrecise, periods } = analysis.daeun;
  const birth = birthInstant(analysis).getTime();
  const target = period.start.getTime();

  let current = periods[0];
  for (let i = 1; i < periods.length; i += 1) {
    const at = birth + (startAgePrecise + i * 10) * YEAR_MS;
    if (at > target) break;
    current = periods[i];
  }
  return current;
}

/**
 * friction 을 잴 대상. 그해 대부분을 차지하는 대운을 대표로 쓴다.
 *
 * 전환이 있으면 전환 뒤쪽이 아니라 앞쪽을 쓴다 — 연초부터 적용되는 쪽이다.
 * 전환 자체는 pivots.ts 가 따로 잰다.
 */
export function frictionTargets(analysis: SajuAnalysis, year: number): FrictionTargets {
  const c = analysis.chart;
  const sewun = parsePillar2(sewunPillars(year, 1)[0].korean)!;
  const period = flowYearOf(year);
  const sw = daeunSwitchIn(analysis, period);
  const current = sw?.before ?? currentDaeun(analysis, period);
  return {
    natal: [c.year.branch, c.month.branch, c.day.branch, c.hour?.branch].filter(
      (b): b is NonNullable<typeof b> => b != null,
    ),
    sewun: sewun.branch,
    daeun: current.branch,
  };
}

/** 일간 오행 기준으로 다른 오행이 무슨 세력인가. yongsin.ts 의 groupElements 와 같은 정의다. */
function groupOf(dayEl: Element, other: Element): TenGodGroup {
  if (other === dayEl) return "비겁";
  if (other === generatedBy(dayEl)) return "인성";
  if (other === elementGenerates(dayEl)) return "식상";
  if (other === elementControls(dayEl)) return "재성";
  return "관성";
}

/** 12개 월운 전부를 채점한다. */
export function monthScores(analysis: SajuAnalysis, year: number): MonthScore[] {
  const targets = frictionTargets(analysis, year);
  const dayEl = STEMS[analysis.chart.dayMaster].element;

  return monthTermsOf(year).map((term, i) => {
    const p = parsePillar2(term.korean)!;
    const groups = new Set<TenGodGroup>();
    groups.add(groupOf(dayEl, STEMS[p.stem].element));
    groups.add(groupOf(dayEl, branchElementOf(p.branch)));

    return {
      index: i + 1,
      term,
      support: supportOf(p, analysis.yongsin),
      friction: frictionOf(p.branch, targets),
      interactions: relationsOf(p.branch, targets),
      samhap: samhapGain(p.branch, targets) > 0,
      tenGods: [...groups],
    };
  });
}
