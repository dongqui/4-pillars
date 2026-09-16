import type { FlowRevisionRow } from "@/lib/flows/revisions";

export type FlowRoute = "v2:published" | "v1" | "v2:generate" | "v2:failed";

/** 플래그는 입력이 아니다 — 플래그를 꺼도 발행본 읽기·pending 완료·failed 재시도는 그대로다(스펙 §10). */
export function resolveFlowRoute(s: {
  active: FlowRevisionRow | null;
  /** flow_sections 행 존재 여부(hasAnyFlowSections). 낡은 버전 행만 남은 v1 도 v1 이다 */
  hasV1Sections: boolean;
  pending: FlowRevisionRow | null;
  latest: FlowRevisionRow | null;
}): FlowRoute {
  if (s.active) return "v2:published";
  if (s.hasV1Sections) return "v1";
  if (s.pending) return "v2:generate";
  if (s.latest?.phase === "failed") return "v2:failed";
  return "v1";
}
