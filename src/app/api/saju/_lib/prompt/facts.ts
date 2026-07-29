// SajuAnalysis(계산값) → LLM 이 읽을 [사실] 블록.
//
// ⚠️ 캐시 경계가 곧 프롬프트 경계다.
//   chartFacts 는 storage="chart" 섹션에 쓰이고, 그 섹션은 chartKey(4기둥+성별)로만
//   캐시된다. 여기에 이름·생년월일·시각을 한 글자라도 넣으면 그 서술이 같은 원국을 가진
//   **다른 사람에게 그대로 재사용된다**. 필드를 추가할 때 "이 값이 chartKey 안에 있나"를
//   먼저 확인하라. (key.ts:chartKey / types.ts:InterpretationGenerator 주석 참고)

import { sewunPillars, type PillarPosition, type SajuAnalysis } from "@/lib/saju-core";
import { STEMS, type Element } from "@/lib/saju-core/data/stems";
import type { TenGod, TenGodGroup } from "@/lib/saju-core/data/relations";

const ELEMENT_ORDER: Element[] = ["목", "화", "토", "금", "수"];

const TEN_GOD_ORDER: TenGod[] = [
  "비견", "겁재", "식신", "상관", "편재",
  "정재", "편관", "정관", "편인", "정인",
];

const GROUP_ORDER: TenGodGroup[] = ["비겁", "식상", "재성", "관성", "인성"];

const POSITION_LABEL: Record<PillarPosition, string> = {
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
};

/** 소수점이 붙는 가중 점수만 한 자리로 줄인다 (5 → "5", 2.5 → "2.5"). */
const num = (n: number): string => String(Math.round(n * 10) / 10);

const join = (parts: string[]): string => parts.join(" · ");

/**
 * chart 저장소 섹션(overview~wealth)용 사실 블록.
 * chartKey 안에 있는 값 = 4기둥 · 성별 과 거기서 순수하게 파생되는 것만 담는다.
 */
export function chartFacts(analysis: SajuAnalysis): string {
  const { chart, elements, tenGods, strength, yongsin } = analysis;
  const dm = STEMS[chart.dayMaster];

  const tenGodAt = (position: PillarPosition, kind: "stem" | "branch") =>
    tenGods.cells.find((c) => c.position === position && c.kind === kind)?.tenGod;

  const lines: string[] = [
    "[사실 · 원국]",
    `일간: ${chart.dayMaster} (${dm.element}·${dm.yinYang})`,
    `성별: ${chart.gender === "male" ? "남성" : "여성"}`,
  ];

  for (const position of ["year", "month", "day", "hour"] as const) {
    const pillar = chart[position];
    if (!pillar) {
      // 빈 자리를 알려 주지 않으면 LLM 이 시주가 있는 것처럼 지어낸다.
      // (타입상 null 이 될 수 있는 자리는 시주뿐이다)
      lines.push(
        `${POSITION_LABEL[position]}: 없음 (출생 시간 미입력 — 이 자리를 짐작해서 채우지 마라)`,
      );
      continue;
    }
    const stemGod = position === "day" ? "일간(我)" : (tenGodAt(position, "stem") ?? "-");
    const branchGod = tenGodAt(position, "branch") ?? "-";
    lines.push(
      `${POSITION_LABEL[position]} ${pillar.korean}(${pillar.hanja})` +
        ` — 천간 ${pillar.stem} ${stemGod} · 지지 ${pillar.branch} ${branchGod}`,
    );
  }

  lines.push(
    `오행 분포: ${join(ELEMENT_ORDER.map((el) => `${el} ${elements.counts[el]}`))}` +
      ` (총 ${elements.total}자)`,
  );

  const present = TEN_GOD_ORDER.filter((g) => tenGods.distribution[g] > 0);
  const absent = TEN_GOD_ORDER.filter((g) => tenGods.distribution[g] === 0);
  lines.push(`십성 분포: ${join(present.map((g) => `${g} ${tenGods.distribution[g]}`))}`);
  if (absent.length > 0) lines.push(`원국에 없는 십성: ${join(absent)}`);

  lines.push(
    `세력 점수(자리 가중): ${join(GROUP_ORDER.map((g) => `${g} ${num(strength.groupScores[g])}`))}`,
    `신강약: ${strength.level} (일간을 돕는 힘의 비율 ${strength.ratio.toFixed(2)})`,
    // reason 은 억부 판정의 내부 사유라 "신강약" 줄과 표현이 어긋날 수 있다
    // (yongsin.ts 는 0.5 를 경계로 보고, strength.ts 는 0.45/0.55 로 중화를 둔다).
    // 그대로 이어 붙이면 LLM 이 모순으로 읽으므로 라벨을 달아 사유임을 못박는다.
    `용신: ${yongsin.yongsin} · 희신: ${yongsin.huisin} (선택 사유: ${yongsin.reason})`,
  );

  return lines.join("\n");
}

/**
 * luck 저장소 섹션(yearlyLuck·daeunOutlook)용 사실 블록.
 * chartFacts 에 대운 회차와 세운 간지를 덧붙인다.
 *
 * "지금 몇 번째 대운인가"는 넣지 않는다 — 그 값은 출생 연도에 의존하는데
 * luckKey 에는 출생 연도가 없다(key.ts:luckKey). 넣으면 같은 원국·다른 세대의
 * 캐시가 서로를 덮어쓴다. 현재 구간 표시는 화면(to-report-content)이 따로 계산한다.
 */
export function luckFacts(analysis: SajuAnalysis, year: number, years: number): string {
  const { daeun } = analysis;

  const daeunLines = daeun.periods.map(
    (p) => `${p.index}) ${p.pillar}(${p.pillarHanja}) — ${p.startAge}세부터 10년`,
  );

  const sewunLines = sewunPillars(year, years).map(
    (s, i) => `${i + 1}) ${s.year}년 ${s.korean}(${s.hanja})`,
  );

  return [
    chartFacts(analysis),
    "",
    "[사실 · 대운]",
    `방향: ${daeun.direction} · 대운수 ${daeun.daeunSu} (첫 대운이 시작되는 나이)`,
    ...daeunLines,
    "",
    "[사실 · 세운]",
    ...sewunLines,
    "",
    "※ 위 목록의 번호·연도·나이는 순서를 맞추기 위한 참고값이다." +
      " 몇 번째 항목인지만 지키고, 연도와 나이는 서술에 쓰지 마라.",
  ].join("\n");
}
