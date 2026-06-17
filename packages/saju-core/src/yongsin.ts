// 용신/희신 — 억부법(抑扶法)
//
// 신약이면 일간을 돕는 오행(인성/비겁), 신강이면 일간을 설기·극하는 오행(식상/재성/관성)을
// 용신으로 삼는다. 희신은 용신을 생(生)하는 오행으로 정의한다.
// (조후·통관·병약법은 범위 밖. 단순화된 억부 모델.)

import type { Chart } from "./chart.js";
import type { StrengthLevel, StrengthScore } from "./strength.js";
import { STEMS, type Element } from "./data/stems.js";
import {
  controlledBy,
  elementControls,
  elementGenerates,
  generatedBy,
  type TenGodGroup,
} from "./data/relations.js";

export interface Yongsin {
  method: "억부";
  /** 판정 근거가 된 신강/신약 */
  basis: StrengthLevel;
  /** 용신 오행 */
  yongsin: Element;
  /** 희신 오행 (용신을 생하는 오행) */
  huisin: Element;
  /** 선택 사유 */
  reason: string;
}

/** 일간 오행 D 기준, 5세력 각각의 오행 */
function groupElements(D: Element): Record<TenGodGroup, Element> {
  return {
    비겁: D,
    인성: generatedBy(D), // D를 생하는 오행
    식상: elementGenerates(D), // D가 생하는 오행
    재성: elementControls(D), // D가 극하는 오행
    관성: controlledBy(D), // D를 극하는 오행
  };
}

export function selectYongsin(chart: Chart, strength: StrengthScore): Yongsin {
  const D = STEMS[chart.dayMaster].element;
  const el = groupElements(D);
  const g = strength.groupScores;
  // ratio>=0.5는 신강쪽(설기), <0.5는 신약쪽(부조)
  const strongSide = strength.ratio >= 0.5;

  let yongsin: Element;
  let reason: string;

  if (!strongSide) {
    // 신약: 비우호 세력 중 최강을 보고 부조 방식 결정
    const drains: TenGodGroup[] = ["재성", "관성", "식상"];
    const max = drains.reduce((a, b) => (g[b] > g[a] ? b : a));
    if (max === "재성") {
      yongsin = el.비겁;
      reason = "신약·재성 과다 → 비겁으로 부조(군겁)";
    } else {
      yongsin = el.인성;
      reason = `신약·${max} 과다 → 인성으로 생조`;
    }
  } else {
    // 신강: 우호 세력 중 최강을 보고 설기/극 방식 결정
    const max: TenGodGroup = g.인성 >= g.비겁 ? "인성" : "비겁";
    if (max === "인성") {
      yongsin = el.재성;
      reason = "신강·인성 과다 → 재성으로 극인·설기";
    } else {
      yongsin = el.식상;
      reason = "신강·비겁 과다 → 식상으로 설기";
    }
  }

  return {
    method: "억부",
    basis: strength.level,
    yongsin,
    huisin: generatedBy(yongsin),
    reason,
  };
}
