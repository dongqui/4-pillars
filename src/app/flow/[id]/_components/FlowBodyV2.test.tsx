import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowBodyV2 } from "./FlowBodyV2";
import { toPublicFlowReportV2 } from "@/app/api/flows/_lib/v2/presentation";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "@/app/api/flows/_lib/v2/__fixtures__/reports";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "@/app/api/flows/_lib/pivots";

const a = analyze({ year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" });
const months = flowMonths(a, 2027);
const report = toPublicFlowReportV2(makeValidFlowReportFixture(makeEvidenceFixture(2027)), { careerTitle: "학업운", reference: "selected_year_start" });
const html = renderToStaticMarkup(<FlowBodyV2 report={report} months={months} currentIndex={null} profileId="11" />);

describe("FlowBodyV2", () => {
  it("7섹션이 번호 순서로", () => {
    const idx = ["01 · 총운", "02 · 학업운", "03 · 재물운", "04 · 연애운", "05 · 대인운", "06 · 월별 운세", "07 · 이 해를 잘 보내는 법"].map((t) => html.indexOf(t));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });
  it("월 앵커·CTA·정보 기준·면책", () => {
    expect(html).toContain('id="month-01"');
    expect(html).toContain('href="/consult?profile=11"');
    expect(html).toContain('href="/match"');
    expect(html).toContain('href="/map"');
    expect(html).toContain("선택한 해 초의 상황을 참고했어요");
    expect(html).toContain("사주를 바탕으로 한 해석이에요");
  });
  it("변곡점이 없으면 중립 문구", () => {
    const none = months.map((m) => ({ ...m, pivot: false }));
    expect(renderToStaticMarkup(<FlowBodyV2 report={report} months={none} currentIndex={null} profileId="11" />)).toContain("큰 전환점으로 따로 표시한 달은 없어요");
  });
});
