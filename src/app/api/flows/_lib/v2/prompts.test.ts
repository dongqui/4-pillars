import { describe, expect, it } from "vitest";
import { buildFlowReportUserV2, FLOW_REPORT_SYSTEM_V2 } from "./prompts";
import { buildFlowGenerationInput } from "./input";
import { makeEvidenceFixture } from "./__fixtures__/reports";

const input = buildFlowGenerationInput({
  flowYear: 2027, relation: "future",
  snapshot: { career: "student", relationship: "crushing", mainConcern: "romance", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" },
  evidence: makeEvidenceFixture(),
});

describe("buildFlowReportUserV2", () => {
  const user = buildFlowReportUserV2(input);
  it("[입력 데이터] 다음에 입력 JSON 이 그대로 있다", () => {
    expect(user).toContain(`[입력 데이터]\n${JSON.stringify(input, null, 2)}\n[입력 데이터 끝]`);
  });
  it("프롬프트가 부르는 키가 JSON 에 있다", () => {
    expect(user).toContain('"careerSituation": "student"');
    expect(user).toContain('"relationshipSituation": "crushing"');
  });
  it("조립 설명 문구가 남지 않는다", () => {
    expect(user).not.toContain("서버에서 직렬화한");
    expect(user).not.toContain("선택된 예시 JSON");
  });
  it("문체 예시 3종이 실린다", () => {
    expect(user).toContain("표현은 수월하지만 동시 진행이 부담인 경우");
    expect((user.match(/"case":/g) ?? []).length).toBe(3);
  });
  it("crushing·complicated 규칙이 실린다", () => {
    expect(user).toContain("crushing:");
    expect(user).toContain("complicated:");
  });
});
it("시스템 프롬프트는 문서 첫 줄로 시작한다", () => {
  expect(FLOW_REPORT_SYSTEM_V2.startsWith("당신은 한국어 연간 사주 풀이를 작성하는 편집자다.")).toBe(true);
});
