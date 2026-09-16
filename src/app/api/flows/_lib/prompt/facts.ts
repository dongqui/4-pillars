// 계산값 → LLM 이 읽을 [사실] 블록.
//
// ⚠️ 내부 계산값(점수·확률)을 숫자로 넘기지 않는다. support/friction 은 범주
// 라벨로, 십성은 그룹 이름으로 넘긴다. 궁합이 나이차를 "또래 | 터울 | 한 세대 차"
// 로 바꿔 넘긴 것과 같은 처리다.
//
// 달은 **순번**(1‥12)으로 넘긴다. 앞선 설계는 숫자가 든 줄을 통째로 걸러냈지만
// 그 필터가 신강약·오행 분포·십성 분포·세력 점수 네 줄을 함께 날렸다 — LLM 이
// 신강인지 신약인지 모른 채 쓰고 있었다. 금지 대상은 **지어낸 시점과 기간**이지
// 달의 순번이 아니다.
//
// 명리 용어를 여기 넣는 것은 리포트의 chartFacts 가 이미 하는 일이다. 기획서 §27 이
// 금지하는 것은 출력이지 입력이 아니다.
//
// chartFacts 를 재사용하지 않는다 — 그쪽은 리포트용이라 점수·나이가 숫자로 섞여
// 있고, "숫자가 든 줄을 통째로 거른다" 는 필터가 신강약까지 함께 날린 것이 이
// 파일이 고치는 버그다. 여기서는 처음부터 범주 라벨로만 블록을 짓는다.
//
// 십성 분포: analysis.tenGods.distribution(원국 10개 유형 원값)은 넘기지 않는다.
// year.tenGods(달들이 실제로 겪는 오행 세력을 groupOf 로 접은 TenGodGroup 집합)가
// 이미 "이 해에 어떤 힘이 두드러지는가" 를 답한다 — 02·03 이 필요로 하는 것은
// 원국의 정적 분포가 아니라 흐름이 건드리는 세력이다. 원국 분포는 report 쪽
// chartFacts 가 이미 다루는 몫이라 여기서 중복하지 않는다.

import {
  STEMS,
  daeunSwitchIn,
  flowYearOf,
  sewunPillars,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
// 배럴은 daeunSwitchIn 만 내보낸다 — birthInstant/YEAR_MS 는 currentDaeun 과
// 정확히 같은 정밀도로 나이를 재야 해서 소스 파일에서 직접 가져온다.
import { birthInstant, YEAR_MS } from "@/lib/saju-core/flow/switch";
import { currentDaeun, monthScores, type MonthScore } from "../month-scores";
import type { FlowMonth } from "../pivots";

export interface YearFacts {
  sewunKorean: string;
  daeunKorean: string;
  /** 이 해가 대운 10년의 어디쯤인가 */
  daeunPhase: "초반" | "중반" | "후반";
  /** 그 해에 대운이 바뀌면 전후 간지. 없으면 null */
  daeunSwitch: { before: string; after: string } | null;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
}

export interface MonthFacts {
  /** 1‥12 */
  index: number;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
  /** 앞 달과 세력이 달라졌으면 그 문구. 첫 달과 변화 없는 달은 null */
  tenGodsChanged: string | null;
  /** "일지와 충" 처럼 읽을 수 있게 편 관계 목록 */
  interactions: string[];
  samhap: boolean;
  /** 첫 달은 null */
  vsPrev: string | null;
  pivot: boolean;
}

export interface FlowContext {
  analysis: SajuAnalysis;
  flowYear: number;
  year: YearFacts;
  months: MonthFacts[];
  /** 변곡점인 달의 순번. [연간] 의 변곡점 줄이 이 값으로 조립된다 */
  pivotMonths: number[];
}

export function supportLabel(v: number): string {
  if (v >= 0.6) return "크게 받쳐줌";
  if (v >= 0.2) return "받쳐줌";
  if (v > -0.2) return "중립";
  if (v > -0.6) return "눌림";
  return "크게 눌림";
}

export function frictionLabel(v: number): string {
  if (v >= 0.3) return "크게 흔들림";
  if (v >= 0.1) return "흔들림";
  if (v > -0.1) return "잔잔함";
  return "묶임";
}

export function deltaPhrase(prev: MonthScore, cur: MonthScore): string {
  const parts: string[] = [];
  const ds = cur.support - prev.support;
  const df = cur.friction - prev.friction;
  if (Math.abs(ds) >= 0.15) parts.push(ds > 0 ? "받쳐줌이 커짐" : "받쳐줌이 줄어듦");
  if (Math.abs(df) >= 0.15) parts.push(df > 0 ? "흔들림이 커짐" : "흔들림이 줄어듦");
  return parts.length > 0 ? parts.join(", ") : "성격은 비슷하되 무게중심이 옮겨감";
}

/**
 * 오행 분포를 숫자 대신 라벨로. 리포트의 chartFacts 와 달리 점수를 안 준다.
 *
 * 0.35/0.1 경계는 편집적 판단이다 — PIVOT_THRESHOLD(pivots.ts)처럼 실측
 * 스윕으로 고른 값이 아니라 "5글자 중 2개면 많다, 0~1개면 적다" 정도의 직관을
 * 그대로 옮긴 것이다. 바꾸려면 근거를 새로 만들 것 — 지금은 없다.
 */
export function distributionLabel(count: number, total: number): string {
  if (count === 0) return "없음";
  const share = count / total;
  if (share >= 0.35) return "많음";
  if (share <= 0.1) return "적음";
  return "보통";
}

/**
 * 대운 10년 안에서 이 해의 위치.
 *
 * daeunSwitch 와 **별도로** 유지한다 — 전환이 있는 해를 "중반" 하나로 뭉개면 그
 * 해의 가장 큰 배경 변화가 사실 블록에서 사라진다.
 *
 * 나이는 currentDaeun(month-scores.ts)과 같은 식으로 잰다:
 * birth + (startAgePrecise + i×10) × YEAR_MS. 반올림된 periods[i].startAge 로
 * 근사하면 currentDaeun 이 고른 회차와 여기서 재는 나이가 서로 다른 기준이 되어,
 * 경계 부근 해에서 "초반/후반" 이 실제 회차와 어긋날 수 있다 — daeunSwitchIn 의
 * 주석이 이미 지적한 것과 같은 종류의 반년 오차다.
 */
export function daeunPhaseOf(analysis: SajuAnalysis, flowYear: number): "초반" | "중반" | "후반" {
  const period = flowYearOf(flowYear);
  const daeun = currentDaeun(analysis, period);
  const idx = analysis.daeun.periods.indexOf(daeun);
  const start = analysis.daeun.startAgePrecise + Math.max(idx, 0) * 10;
  const birth = birthInstant(analysis).getTime();
  // 이 해 시작 시점의 정밀 나이 — currentDaeun 이 회차를 고를 때 쓰는 것과 같은 자
  const ageAtStart = (period.start.getTime() - birth) / YEAR_MS;
  const elapsed = Math.min(Math.max(ageAtStart - start, 0), 9.999);
  // 4/7 도 편집적 판단이다 — 10년을 정확히 삼등분(3.33/6.67)하지 않고 가운데
  // 구간을 살짝 넓혀 "초반·후반"의 경계가 조금 더 여유 있게 잡히도록 고른
  // 값이다. PIVOT_THRESHOLD 같은 실측 근거는 없다. 바꾸려면 그 근거를 새로
  // 만들 것.
  if (elapsed < 4) return "초반";
  if (elapsed < 7) return "중반";
  return "후반";
}

export function buildFlowContext(
  analysis: SajuAnalysis,
  flowYear: number,
  months: FlowMonth[],
): FlowContext {
  const scores = monthScores(analysis, flowYear);
  const period = flowYearOf(flowYear);
  const sw = daeunSwitchIn(analysis, period);
  const daeun = sw?.before ?? currentDaeun(analysis, period);

  const pivotOf = new Map(months.map((m) => [m.index, m.pivot]));

  const monthFacts: MonthFacts[] = scores.map((cur, i) => {
    const prev = i === 0 ? null : scores[i - 1];
    const changed =
      prev && prev.tenGods.join("·") !== cur.tenGods.join("·")
        ? `앞달의 ${prev.tenGods.join("·")}에서 바뀜`
        : null;

    return {
      index: cur.index,
      support: supportLabel(cur.support),
      friction: frictionLabel(cur.friction),
      tenGods: cur.tenGods,
      tenGodsChanged: changed,
      interactions: cur.interactions.map((r) => `${r.target}와 ${r.kind}`),
      samhap: cur.samhap,
      vsPrev: prev ? deltaPhrase(prev, cur) : null,
      pivot: pivotOf.get(cur.index) ?? false,
    };
  });

  const mean = (pick: (s: MonthScore) => number) =>
    scores.reduce((a, s) => a + pick(s), 0) / scores.length;

  const yearGroups = new Set<TenGodGroup>();
  for (const s of scores) for (const g of s.tenGods) yearGroups.add(g);

  return {
    analysis,
    flowYear,
    year: {
      sewunKorean: sewunPillars(flowYear, 1)[0].korean,
      daeunKorean: daeun.pillar,
      daeunPhase: daeunPhaseOf(analysis, flowYear),
      daeunSwitch: sw ? { before: sw.before.pillar, after: sw.after.pillar } : null,
      support: supportLabel(mean((s) => s.support)),
      friction: frictionLabel(mean((s) => s.friction)),
      tenGods: [...yearGroups],
    },
    months: monthFacts,
    pivotMonths: monthFacts.filter((m) => m.pivot).map((m) => m.index),
  };
}

export function flowFacts(ctx: FlowContext): string {
  const { analysis, year } = ctx;
  const dm = STEMS[analysis.chart.dayMaster];
  const el = analysis.elements;
  const elTotal = Object.values(el.counts).reduce((a, b) => a + b, 0) || 1;

  const lines: string[] = [
    "[연간]",
    `일간: ${analysis.chart.dayMaster} (${dm.element}·${dm.yinYang})`,
    `성별: ${analysis.chart.gender === "male" ? "남성" : "여성"}`,
    // ⚠️ 이 줄이 F1 의 핵심이다. 앞선 구현은 숫자 필터가 이 줄을 통째로 날려
    // LLM 이 신강인지 신약인지 모른 채 모든 리포트를 썼다.
    `신강약: ${analysis.strength.level}`,
    `오행 분포: ${Object.entries(el.counts)
      .map(([k, v]) => `${k} ${distributionLabel(Number(v), elTotal)}`)
      .join(" · ")}`,
    `용신: ${analysis.yongsin.yongsin} · 희신: ${analysis.yongsin.huisin}`,
    `올해 간지: ${year.sewunKorean}`,
    `받쳐줌: ${year.support}`,
    `흔들림: ${year.friction}`,
    `두드러지는 힘: ${year.tenGods.join(" · ")}`,
  ];

  // 배경(대운) 위치는 보조 사실이다 — "초반" 은 대략 3년쯤 이어지는데, 이 줄을
  // 위 '올해 간지' 옆에 나란히 두면 무게가 같아 보여 모델이 매년 "새로 시작되는
  // 해" 라고 반복해서 쓰는 사고가 난다. 그래서 그 해 자체의 사실들 뒤로 옮기고
  // 라벨에 "참고용" 을 못박는다 — daeunPhase 값 자체는 지우지 않는다, 01 이
  // 큰 흐름 속 위치를 잡는 데 정말로 필요하기 때문이다.
  lines.push(
    `배경(참고용 — 여러 해에 걸쳐 비슷하게 유지됨): ${year.daeunKorean} · ${year.daeunPhase}`,
  );

  // 전환은 배경 중에서도 예외다 — 이 해에 실제로 바뀌는 사실이라, 뭉개면 그
  // 해의 가장 큰 배경 변화가 사라진다. 위 "참고용" 줄과 달리 이 줄은 지금도
  // 프롬프트 상 지위를 그대로 유지한다.
  if (year.daeunSwitch) {
    lines.push(`배경 전환: ${year.daeunSwitch.before} → ${year.daeunSwitch.after}`);
  }

  // 변곡점을 **연간 사실로도** 적는다. 아래 달 블록의 "변곡점: 예" 만 두면 0개인
  // 해에는 아무 줄도 안 생겨서, 모델이 보는 것은 "없다는 사실" 이 아니라 "아무 말도
  // 없음" 이다(§21). 07 이 lead 에서 한 해의 호를 요약할 때 이 줄이 근거가 된다.
  lines.push(
    ctx.pivotMonths.length === 0
      ? "변곡점: 없음 (이 해는 흐름이 크게 꺾이는 지점이 계산되지 않았다)"
      : `변곡점: ${ctx.pivotMonths.map((n) => `${n}번째 달`).join(" · ")}`,
  );

  for (const m of ctx.months) {
    lines.push(
      "",
      `[${m.index}번째 달]`,
      `받쳐줌: ${m.support} · 흔들림: ${m.friction}`,
      `두드러지는 힘: ${m.tenGods.join(" · ")}${m.tenGodsChanged ? ` (${m.tenGodsChanged})` : ""}`,
    );
    if (m.interactions.length > 0) lines.push(`작용: ${m.interactions.join(" · ")}`);
    if (m.samhap) lines.push("결속: 새로 완성됨");
    // 이 줄이 §36 의 핵심이다. 없으면 LLM 이 각 달을 독립적으로 소개해서
    // "무엇이 달라지는가" 가 아니라 "각 달이 어떤가" 가 된다.
    if (m.vsPrev) lines.push(`앞달 대비: ${m.vsPrev}`);
    if (m.pivot) lines.push("변곡점: 예");
  }

  return lines.join("\n");
}
