import {
  FLOW_SECTION_KEYS,
  type FlowInterpretation,
  type FlowSectionKey,
} from "@/app/api/flows/_lib/sections";

export interface FlowSectionView {
  key: FlowSectionKey;
  content: FlowInterpretation[FlowSectionKey];
}

/**
 * 저장된 서술 → 화면 모델.
 *
 * 앞선 설계는 읽는 시점의 구간을 골라 냈다. 이제 고를 것이 없다 — 본문이 12개월
 * 전부다. 남은 일은 없는 섹션을 빼고 선언 순서로 세우는 것뿐이다.
 *
 * 없는 섹션을 빼는 이유는 그대로다 — 생성이 일부 실패해도 확보한 섹션은 보여야
 * 한다. 이용권을 쓴 결과다.
 */
export function toFlowView(
  interpretation: Partial<FlowInterpretation>,
): FlowSectionView[] {
  const out: FlowSectionView[] = [];
  for (const key of FLOW_SECTION_KEYS) {
    const content = interpretation[key];
    if (!content) continue;
    out.push({ key, content } as FlowSectionView);
  }
  return out;
}
