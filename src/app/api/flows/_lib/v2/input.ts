import { careerTitle, type ContextSnapshot, type YearRelation } from "@/lib/flows/context";
import type { FlowMonth } from "../pivots";
import type { Evidence } from "./facts";
import { PROMPT_BUNDLE_VERSION } from "./prompts";

/** 프롬프트 문서 §3 의 모양. 키 이름은 문서를 따른다 — 시스템·user 프롬프트가 그 이름을 직접 부른다. */
export interface FlowGenerationInput {
  request: { flowYear: number; selectedYearRelation: YearRelation; careerTitle: string; promptBundleVersion: number };
  personalContext: {
    reference: ContextSnapshot["reference"];
    careerSituation: ContextSnapshot["career"];
    relationshipSituation: ContextSnapshot["relationship"];
    mainConcern: ContextSnapshot["mainConcern"];
    asOf: string;
  };
  evidence: Evidence;
}

export function buildFlowGenerationInput(a: {
  flowYear: number; relation: YearRelation; snapshot: ContextSnapshot; evidence: Evidence; months: FlowMonth[];
}): FlowGenerationInput {
  void a.months; // months 는 evidence.months 에 이미 접혀 있다. 서명은 스펙과 맞춘다.
  return {
    request: {
      flowYear: a.flowYear, selectedYearRelation: a.relation,
      careerTitle: careerTitle(a.snapshot.career), promptBundleVersion: PROMPT_BUNDLE_VERSION,
    },
    personalContext: {
      reference: a.snapshot.reference,
      careerSituation: a.snapshot.career, relationshipSituation: a.snapshot.relationship,
      mainConcern: a.snapshot.mainConcern, asOf: a.snapshot.asOf,
    },
    evidence: a.evidence,
  };
}
