import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toReportContent } from "./to-report-content";

const analysis = analyze({ year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male" });
const meta = { name: "홍길동", birthLine: "양력 1990.02.20 04:30" };

const traits = [1, 2, 3, 4].map((n) => ({
  title: `t${n}`,
  body: `b${n}`,
  basis: `근거${n}`,
}));

const free: Partial<Interpretation> = {
  overview: { headline: "헤드라인", summary: "요약", traits },
  outerVsInner: { outward: "겉", inner: "속" },
  strengths: [{ title: "s", body: "b" }, { title: "s2", body: "b2" }],
  cautions: { items: ["주의1", "주의2"], tip: "팁" },
};

describe("toReportContent", () => {
  it("overview 를 상단 필드로 편다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.headline).toBe("헤드라인");
    expect(c.summary).toBe("요약");
  });

  // 이 테스트가 병합의 목적 그 자체다. personality 가 곧 traits 그대로이므로, 히어로
  // 칩(ReportBody 가 personality.map(t => t.title) 로 뽑는다)과 01 카드는 렌더 시점에
  // 같은 배열에서 나와 갈라질 수 없다.
  it("01 카드는 traits 를 basis 까지 그대로 쓴다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.personality).toEqual(traits);
  });

  it("cautions 를 목록과 팁으로 나눈다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.cautions).toEqual(["주의1", "주의2"]);
    expect(c.cautionTip).toBe("팁");
  });

  it("계산값에서 근거 패널을 채운다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
    expect(c.evidence.strength.level).toBe(analysis.strength.level);
  });

  it("유료 섹션이 없으면 undefined (화면이 잠금으로 그린다)", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.emotion).toBeUndefined();
    expect(c.wealth).toBeUndefined();
  });

  it("해석이 아예 비어도 무료 필드는 빈 값으로 성립한다", () => {
    const c = toReportContent(analysis, {}, meta, 2026);
    expect(c.headline).toBe("");
    expect(c.personality).toEqual([]);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
  });

});
