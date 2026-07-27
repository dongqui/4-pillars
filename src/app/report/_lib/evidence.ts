// SajuAnalysis(계산값) → 리포트 01 "근거 자세히 보기" 패널.
// LLM 은 여기 관여하지 않는다. 숫자를 지어내지 못하게 하려고 계산값은 전부 여기서 만든다.

import type { SajuAnalysis } from "@/lib/saju-core";
import { STEMS, type Element } from "@/lib/saju-core/data/stems";
import { BRANCHES } from "@/lib/saju-core/data/branches";
import type {
  ChartEvidence,
  ElementCount,
  ElementKey,
  EvidenceTag,
  PillarCell,
  PillarColumn,
} from "./report-content";

export const EVIDENCE_DISCLAIMER =
  "위 요소들은 개별 점수가 아니라 서로의 관계 속에서 종합적으로 해석되며, 이 리포트의 모든 결과는 이 원국 데이터를 근거로 작성되었습니다. 특정 오행이 적다는 것만으로 좋고 나쁨을 단정하지 않습니다.";

const ELEMENT_KEY: Record<Element, ElementKey> = {
  목: "wood",
  화: "fire",
  토: "earth",
  금: "metal",
  수: "water",
};

const ORDER: Element[] = ["목", "화", "토", "금", "수"];

/** 화면은 시→년 순으로 읽는다 (오른쪽이 년주). */
const SLOTS = ["hour", "day", "month", "year"] as const;

export function toChartEvidence(analysis: SajuAnalysis, year: number): ChartEvidence {
  const { chart, elements, tenGods, strength, yongsin, daeun } = analysis;

  // 십성은 (자리, 천간/지지)로 찾는다
  const tenGodAt = (slot: string, kind: "stem" | "branch") =>
    tenGods.cells.find((c) => c.position === slot && c.kind === kind)?.tenGod ?? null;

  const pillars: PillarColumn[] = [];
  for (const slot of SLOTS) {
    const pillar = chart[slot];
    if (!pillar) continue; // 시주 미입력
    const isDayMaster = slot === "day";
    const stem: PillarCell = {
      char: pillar.hanja[0],
      ko: pillar.stem,
      element: ELEMENT_KEY[STEMS[pillar.stem].element],
      tenGod: isDayMaster ? "일간 · 我" : (tenGodAt(slot, "stem") ?? "-"),
    };
    const branch: PillarCell = {
      char: pillar.hanja[1],
      ko: pillar.branch,
      element: ELEMENT_KEY[BRANCHES[pillar.branch].element],
      tenGod: tenGodAt(slot, "branch") ?? "-",
    };
    pillars.push(isDayMaster ? { slot, isDayMaster, stem, branch } : { slot, stem, branch });
  }

  const max = Math.max(...ORDER.map((el) => elements.counts[el]));
  const elementBars: ElementCount[] = ORDER.map((el) => ({
    element: ELEMENT_KEY[el],
    count: elements.counts[el],
    max,
  }));

  // 음양은 원국 8자(천간 + 지지 본기) 기준 — elements.total 과 같은 집계 범위.
  // 지지는 본기 천간의 음양을 따른다 (elements 집계와 같은 규칙).
  let yang = 0;
  let yin = 0;
  for (const slot of SLOTS) {
    const pillar = chart[slot];
    if (!pillar) continue;
    for (const stem of [pillar.stem, BRANCHES[pillar.branch].mainStem]) {
      if (STEMS[stem].yinYang === "양") yang += 1;
      else yin += 1;
    }
  }

  // 태그: 신강약 · 용신 · 희신 · 개수가 많은 십성 상위 3개.
  // 신살(역마·화개 등)은 saju-core 에 계산이 없어 넣지 않는다.
  const topTenGods = Object.entries(tenGods.distribution)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const tags: EvidenceTag[] = [
    { label: strength.level, tone: "accent" },
    { label: `용신 · ${yongsin.yongsin}`, tone: "metal" },
    { label: `희신 · ${yongsin.huisin}`, tone: "fire" },
    ...topTenGods.map(([name, n]): EvidenceTag => ({
      label: n > 1 ? `${name} ×${n}` : name,
      tone: "neutral",
    })),
  ];

  // daeun.periods[].startAge 는 세는 나이 기준(luck.ts 주석 참고: "세는 나이 기준 대운수 …").
  // 만 나이(year - solar.year)로 비교하면 경계에서 대운이 하나씩 밀려 잘못 표시된다.
  // 세는 나이는 "태어난 해를 1살로 센다" → 해당 연도 - 출생 연도 + 1.
  const age = year - chart.solar.year + 1;
  const daeunStrip = daeun.periods.map((p) => ({
    gan: p.pillarHanja,
    age: `${p.startAge}–${p.startAge + 9}세`,
    ...(age >= p.startAge && age < p.startAge + 10 ? { now: true } : {}),
  }));

  return {
    pillars,
    elements: elementBars,
    yinYang: { yang, yin },
    strength: { level: strength.level, percent: Math.round(strength.ratio * 100) },
    tags,
    daeunStrip,
    disclaimer: EVIDENCE_DISCLAIMER,
  };
}
