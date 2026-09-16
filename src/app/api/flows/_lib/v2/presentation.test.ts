import { expect, it } from "vitest";
import { toPublicFlowReportV2 } from "./presentation";
import { makeValidFlowReportFixture } from "./__fixtures__/reports";

it("내부 필드가 없고 메타가 실린다", () => {
  const p = toPublicFlowReportV2(makeValidFlowReportFixture(), { careerTitle: "학업운", reference: "current_baseline" });
  const text = JSON.stringify(p);
  expect(text).not.toMatch(/interpretation|basisRefs|sourceKeys/);
  expect(p.careerTitle).toBe("학업운");
  expect(p.reference).toBe("current_baseline");
  expect(p.sections.months.items).toHaveLength(12);
});
