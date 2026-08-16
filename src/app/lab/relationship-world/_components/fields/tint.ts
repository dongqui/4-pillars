import type { RelationRole } from "../../_data/roles";

// 좁은 대역 안의 색온 차이일 뿐이다. 채도 전부 26% 이하이며 오행을 지시하지 않는다.
// 구분의 부담은 형태가 진다 — 흑백으로 바꿔놓고도 다섯이 구분되어야 한다.
export const FIELD_TINT: Record<RelationRole, string> = {
  fill: "#d2cec7",
  beside: "#c9cdd2",
  express: "#c2cbd6",
  move: "#bac6d6",
  refine: "#b6c2d4",
};
