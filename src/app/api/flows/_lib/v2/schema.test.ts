import { describe, expect, it } from "vitest";
import { flowReportToolSchema, flowReportV2Schema } from "./schema";
import { makeValidFlowReportFixture } from "./__fixtures__/reports";

const ok = () => makeValidFlowReportFixture();
describe("flowReportV2Schema", () => {
  it("fixture 통과", () => expect(flowReportV2Schema.safeParse(ok()).success).toBe(true));
  it("공백은 trim 뒤 길이를 잰다", () => {
    const r = ok(); r.sections.overview.headline = "   " + "가".repeat(15) + "   ";
    expect(flowReportV2Schema.safeParse(r).success).toBe(true);
    r.sections.overview.headline = "가".repeat(14);
    expect(flowReportV2Schema.safeParse(r).success).toBe(false);
  });
  it("months 는 12개·오름차순·유일", () => {
    const r = ok(); r.sections.months.items[3].monthIndex = 5;
    expect(flowReportV2Schema.safeParse(r).success).toBe(false);
  });
  it("basisRefs 중복·monthLinks 달 중복·sourceKeys 중복 거부", () => {
    const a = ok(); a.sections.overview.basisRefs = [a.sections.overview.basisRefs[0], a.sections.overview.basisRefs[0]];
    expect(flowReportV2Schema.safeParse(a).success).toBe(false);
    const b = ok(); b.sections.career.monthLinks = [{ monthIndex: 3, note: "x" }, { monthIndex: 3, note: "y" }];
    expect(flowReportV2Schema.safeParse(b).success).toBe(false);
    const c = ok(); c.sections.closing.items[0].sourceKeys = ["career", "career"];
    expect(flowReportV2Schema.safeParse(c).success).toBe(false);
  });
  it("basisRefs 항목은 64자를 넘으면 거부 — 모델 자유 텍스트가 validation_errors 에 실리지 못하게", () => {
    const r = ok();
    r.sections.overview.basisRefs = ["가".repeat(65)];
    expect(flowReportV2Schema.safeParse(r).success).toBe(false);
  });
  it("closing 은 3개, sourceKeys 에 closing 불가, 추가 필드 거부", () => {
    const a = ok(); a.sections.closing.items.pop();
    expect(flowReportV2Schema.safeParse(a).success).toBe(false);
    const b = ok() as unknown as { sections: { closing: { items: { sourceKeys: string[] }[] } } };
    b.sections.closing.items[0].sourceKeys = ["closing"];
    expect(flowReportV2Schema.safeParse(b).success).toBe(false);
    const c = { ...ok(), extra: 1 };
    expect(flowReportV2Schema.safeParse(c).success).toBe(false);
  });
});
describe("flowReportToolSchema", () => {
  it("$schema 가 없고 object 다", () => {
    const s = flowReportToolSchema();
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe("object");
  });
});
