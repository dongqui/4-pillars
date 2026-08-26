// 계산값 → LLM 이 읽을 [사실] 블록.
//
// ⚠️ 숫자를 넘기지 않는다. FLOW_SYSTEM_PROMPT 가 지어낸 시점·기간을 금지하는데
// 프롬프트에 숫자가 들어 있으면 예시가 규칙을 이긴다. support/friction 은 범주
// 라벨로, 십성은 그룹 이름으로, 구간은 서수("1/3")로 넘긴다.
// 궁합이 나이차를 "또래 | 터울 | 한 세대 차" 로 바꿔 넘긴 것과 같은 처리다.

import {
  STEMS,
  branchElementOf,
  elementControls,
  elementGenerates,
  generatedBy,
  sewunPillars,
  type Element,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import { parsePillar2 } from "../score";
import { monthScores, type FlowSegment, type SegmentId } from "../segments";

export interface FlowSegmentFacts {
  id: SegmentId;
  /** "1/3" — 구간을 가리키는 유일한 식별자다. 날짜는 주지 않는다 */
  ordinal: string;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
  /** 첫 구간은 null */
  vsPrev: string | null;
}

export interface FlowContext {
  analysis: SajuAnalysis;
  flowYear: number;
  sewunKorean: string;
  daeunKorean: string;
  segments: FlowSegmentFacts[];
}

function supportLabel(v: number): string {
  if (v >= 0.6) return "크게 받쳐줌";
  if (v >= 0.2) return "받쳐줌";
  if (v > -0.2) return "중립";
  if (v > -0.6) return "눌림";
  return "크게 눌림";
}

function frictionLabel(v: number): string {
  if (v >= 0.3) return "크게 흔들림";
  if (v >= 0.1) return "흔들림";
  return "잔잔함";
}

/** 일간 오행 기준으로 다른 오행이 무슨 세력인가. yongsin.ts 의 groupElements 와 같은 정의다. */
function groupOf(dayEl: Element, other: Element): TenGodGroup {
  if (other === dayEl) return "비겁";
  if (other === generatedBy(dayEl)) return "인성";
  if (other === elementGenerates(dayEl)) return "식상";
  if (other === elementControls(dayEl)) return "재성";
  return "관성";
}

function deltaPhrase(prev: { s: number; f: number }, cur: { s: number; f: number }): string {
  const parts: string[] = [];
  const ds = cur.s - prev.s;
  const df = cur.f - prev.f;
  if (Math.abs(ds) >= 0.15) parts.push(ds > 0 ? "받쳐줌이 커짐" : "받쳐줌이 줄어듦");
  if (Math.abs(df) >= 0.15) parts.push(df > 0 ? "흔들림이 커짐" : "흔들림이 줄어듦");
  return parts.length > 0 ? parts.join(", ") : "성격은 비슷하되 무게중심이 옮겨감";
}

/**
 * 구간마다 그 구간에 속한 월운들의 평균으로 두 축을 잡는다.
 *
 * 구간은 여러 달을 묶은 것이라 대표값이 필요하다. 최대값이 아니라 평균을 쓰는 이유:
 * 한 달만 튀는 구간을 "내내 흔들리는 구간" 으로 설명하게 되기 때문이다.
 */
export function buildFlowContext(
  analysis: SajuAnalysis,
  flowYear: number,
  segments: FlowSegment[],
): FlowContext {
  const scores = monthScores(analysis, flowYear);
  const dayEl = STEMS[analysis.chart.dayMaster].element;

  const perSegment = segments.map((seg) => {
    const from = Date.parse(seg.start);
    const to = Date.parse(seg.end);
    const inside = scores.filter(
      (m) => m.term.start.getTime() >= from && m.term.start.getTime() < to,
    );
    const mean = (pick: (m: (typeof inside)[number]) => number) =>
      inside.length === 0 ? 0 : inside.reduce((a, m) => a + pick(m), 0) / inside.length;

    const groups = new Set<TenGodGroup>();
    for (const m of inside) {
      const p = parsePillar2(m.term.korean);
      if (!p) continue;
      groups.add(groupOf(dayEl, STEMS[p.stem].element));
      groups.add(groupOf(dayEl, branchElementOf(p.branch)));
    }

    return {
      seg,
      s: mean((m) => m.support),
      f: mean((m) => m.friction),
      tenGods: [...groups],
    };
  });

  // periods 는 startAge 오름차순이다. "지금 대운" 은 startAge <= 나이 를 만족하는
  // 것 중 가장 늦게 시작한 회차이므로 뒤에서부터 찾는다 — 앞에서부터 find 하면
  // 항상 가장 이른(어린 시절) 회차가 걸린다.
  const age = flowYear - analysis.chart.solar.year + 1;
  const daeun = [...analysis.daeun.periods].reverse().find((p) => p.startAge <= age);

  return {
    analysis,
    flowYear,
    sewunKorean: sewunPillars(flowYear, 1)[0].korean,
    daeunKorean: daeun?.pillar ?? analysis.daeun.periods[0].pillar,
    segments: perSegment.map((cur, i) => ({
      id: cur.seg.id,
      ordinal: `${i + 1}/${segments.length}`,
      support: supportLabel(cur.s),
      friction: frictionLabel(cur.f),
      tenGods: cur.tenGods,
      vsPrev: i === 0 ? null : deltaPhrase(perSegment[i - 1], cur),
    })),
  };
}

export function flowFacts(ctx: FlowContext): string {
  const lines: string[] = [
    "[연간 배경]",
    // chartFacts 는 리포트용이라 나이·연도가 섞인 줄이 있을 수 있다. 그 파일은
    // 리포트가 쓰므로 고치지 않고, 여기서 숫자가 든 줄만 걸러낸다 — 프롬프트에
    // 숫자가 남으면 "시점을 지어내지 마라" 는 규칙보다 그 숫자가 이긴다.
    chartFacts(ctx.analysis)
      .split("\n")
      .filter((l) => !/\d/.test(l))
      .join("\n"),
    `올해 간지: ${ctx.sewunKorean}`,
    `지금 구간의 간지: ${ctx.daeunKorean}`,
    `용신: ${ctx.analysis.yongsin.yongsin} · 희신: ${ctx.analysis.yongsin.huisin}`,
  ];

  for (const s of ctx.segments) {
    lines.push(
      "",
      `[구간 ${s.ordinal}] segmentId=${s.id}`,
      `받쳐줌: ${s.support}`,
      `흔들림: ${s.friction}`,
      `두드러지는 힘: ${s.tenGods.join(" · ")}`,
    );
    // 이 줄이 §12 의 핵심이다. 없으면 LLM 이 각 구간을 독립적으로 소개해서
    // "무엇이 달라지는가" 가 아니라 "각 구간이 어떤가" 가 된다.
    if (s.vsPrev) lines.push(`앞 구간 대비: ${s.vsPrev}`);
  }

  return lines.join("\n");
}
