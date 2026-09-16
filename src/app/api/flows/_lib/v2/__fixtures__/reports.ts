import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../../pivots";
import { buildFlowEvidence, type Evidence } from "../facts";

const BIRTH = { year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" } as const;
export function makeEvidenceFixture(year = 2027): Evidence {
  const a = analyze(BIRTH);
  return buildFlowEvidence(a, year, flowMonths(a, year));
}
