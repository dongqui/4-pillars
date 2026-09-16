import { expect, it } from "vitest";
import { validateReferences } from "./references";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "./__fixtures__/reports";

it("전부 있으면 빈 배열", () => {
  const e = makeEvidenceFixture();
  expect(validateReferences(makeValidFlowReportFixture(e), e)).toEqual([]);
});
it("없는 ID 는 경로와 함께 나온다", () => {
  const e = makeEvidenceFixture();
  const r = makeValidFlowReportFixture(e);
  r.sections.money.basisRefs = ["nope.id"];
  expect(validateReferences(r, e)).toEqual(["/sections/money: nope.id"]);
});
