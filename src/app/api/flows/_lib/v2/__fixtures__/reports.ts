import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../../pivots";
import { buildFlowEvidence, type Evidence } from "../facts";
import type { FlowReportV2 } from "../schema";

const BIRTH = { year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" } as const;
export function makeEvidenceFixture(year = 2027): Evidence {
  const a = analyze(BIRTH);
  return buildFlowEvidence(a, year, flowMonths(a, year));
}

const H = "표현 속도는 빨라지지만 완성할 일을 골라야 하는 해예요"; // 15~55자
export function makeValidFlowReportFixture(evidence: Evidence = makeEvidenceFixture()): FlowReportV2 {
  const ids = evidence.availableFactIds;
  const refs = (n: number) => ids.slice(0, n);
  const monthRefs = (i: number) => evidence.months[i].factIds.slice(0, 2);
  const claim = { conclusion: "벌이기보다 고르는 일이 중요한 해예요.", qualification: "", basisRefs: refs(2) };
  const domain = (n: number) => ({
    headline: H, opportunity: "초안을 보여주고 의견을 받는 과정이 수월해요.", caution: "여러 작업을 동시에 벌리면 마무리에서 집중이 분산되기 쉬워요.",
    action: "이번 달 안에 끝낼 일을 하나 정해요.", monthLinks: [{ monthIndex: n, note: "속도가 붙는 달" }], basisRefs: refs(3),
  });
  return {
    interpretation: { annual: claim, focusDomain: "career", domains: { career: claim, money: claim, romance: claim, relationships: claim } },
    sections: {
      overview: { headline: H, body: "한 해의 핵심 기회와 주의점을 정리해요.", basisRefs: refs(2) },
      career: domain(3), money: domain(5), romance: domain(4), relationships: domain(7),
      months: {
        lead: "안으로 다지던 힘이 밖으로 옮겨가는 한 해예요.",
        items: evidence.months.map((m, i) => ({
          monthIndex: m.monthIndex, headline: "방향을 잡는 달이에요", focusDomain: "overall" as const,
          body: "정리하는 데 마음이 쏠려요.", action: "기준 하나를 정해요.", basisRefs: monthRefs(i),
        })),
      },
      closing: { items: [1, 2, 3].map(() => ({ title: "작은 단위로 먼저 움직이기", body: "한 시간 안에 끝나는 조각을 떼어내 먼저 해봐요.", sourceKeys: ["career" as const] })) },
    },
  };
}
