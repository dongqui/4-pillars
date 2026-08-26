import {
  FLOW_SECTION_KEYS,
  type FlowInterpretation,
  type FlowSegmentBody,
} from "@/app/api/flows/_lib/sections";

export interface FlowSectionView {
  key: string;
  /** 그해 전체의 배경. 07 은 null */
  common: string | null;
  /** 읽는 시점의 구간 서술 */
  current: FlowSegmentBody | null;
  /** 전체 구간. 07 타임라인이 쓴다 */
  all: FlowSegmentBody[];
}

/**
 * 저장된 서술 + 현재 구간 인덱스 → 화면 모델.
 *
 * 없는 섹션은 빼고 낸다 — 생성이 일부 실패해도 확보한 섹션은 보여야 한다.
 */
export function toFlowView(
  interpretation: Partial<FlowInterpretation>,
  index: number,
): FlowSectionView[] {
  const out: FlowSectionView[] = [];

  for (const key of FLOW_SECTION_KEYS) {
    const content = interpretation[key];
    if (!content) continue;

    const all = content.segments;
    const i = Math.min(Math.max(index, 0), all.length - 1);
    out.push({
      key,
      common: "common" in content ? content.common : null,
      current: all[i] ?? null,
      all,
    });
  }

  return out;
}
