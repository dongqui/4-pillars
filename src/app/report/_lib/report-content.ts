// src/app/report/_lib/report-content.ts
// 리포트 전용 뷰모델. UI에서 도출. 향후 SajuAnalysis(계산값) + 확장 Interpretation(LLM 서술)에서 채워질 자리.

export type ElementKey = "wood" | "fire" | "earth" | "metal" | "water";

// 잎 타입은 해석 스키마(sections/primitives)가 원본이다. 여기서 다시 선언하면
// LLM 이 받는 구조와 화면이 읽는 타입이 갈라진다.
// (재수출만으로는 이 파일 안에서 이름을 쓸 수 없어 import type 도 함께 둔다.)
import type { TitledText, LabeledText, KeyValue, TraitNote } from "@/app/api/saju/_lib/sections";
export type { TitledText, LabeledText, KeyValue, TraitNote } from "@/app/api/saju/_lib/sections";

export interface TimelineRow { period: string; title: string; desc: string }
export interface DaeunRow { range: string; title: string; desc: string; now?: boolean }

/** 원국 한 칸(천간 또는 지지) — ← SajuAnalysis.chart */
export interface PillarCell {
  char: string; // 한자 (甲, 子 …)
  ko: string;   // 한글 (갑, 자)
  element: ElementKey;
  tenGod: string; // 십성 (비견 …); 일간 칸은 "일간 · 我"
}
export interface PillarColumn {
  slot: "hour" | "day" | "month" | "year";
  isDayMaster?: boolean;
  stem: PillarCell;
  branch: PillarCell;
}
/** 오행 막대 — ← SajuAnalysis.elements */
export interface ElementCount { element: ElementKey; count: number; max: number }

export type TagTone = "neutral" | "metal" | "fire" | "accent";
export interface EvidenceTag { label: string; tone: TagTone }

/** 01 "근거 자세히 보기" collapse 패널 */
export interface ChartEvidence {
  pillars: PillarColumn[];
  elements: ElementCount[];
  yinYang: { yang: number; yin: number };
  /** ← SajuAnalysis.strength (예: 신강 62%) */
  strength: { level: string; percent: number };
  tags: EvidenceTag[];
  /** ← SajuAnalysis.daeun */
  daeunStrip: { gan: string; age: string; now?: boolean }[];
  disclaimer: string;
}

export interface ReportContent {
  meta: { name: string; birthLine: string };
  headline: string;
  summary: string;
  personality: TraitNote[];         // 01 — 히어로 칩도 이 배열의 title 에서 렌더 시점에 뽑는다
  evidence: ChartEvidence;          // 01 근거
  outerVsInner: { outward: string; inner: string }; // 02
  strengths: TitledText[];          // 03
  cautions: string[];               // 04
  cautionTip: string;               // 04 TIP
  // 아래는 유료 섹션 — 생성되지 않았거나 권한이 없으면 없다.
  emotion?: LabeledText[];          // 05
  relating?: KeyValue[];            // 06
  environment?: { energizing: string[]; draining: string[]; summary: string; emphasis: string }; // 07
  love?: LabeledText[];             // 08
  compatibility?: { good: string[]; clash: string[] }; // 09
  wealth?: { points: LabeledText[]; summary: string; emphasis: string };  // 10
  yearlyLuck?: TimelineRow[];       // 11
  daeunOutlook?: { rows: DaeunRow[]; summary: string; emphasis: string }; // 12
}

/** 무료 사용자에게 보이는 05–12 잠금 목록 항목 */
export interface LockedSectionMeta { no: string; category: string; title: string }
