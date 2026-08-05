import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toReportContent } from "./to-report-content";
import { toChartEvidence } from "./evidence";

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
    expect(c.daeunOutlook).toBeUndefined();
  });

  it("해석이 아예 비어도 무료 필드는 빈 값으로 성립한다", () => {
    const c = toReportContent(analysis, {}, meta, 2026);
    expect(c.headline).toBe("");
    expect(c.personality).toEqual([]);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
  });

  it("대운 서술에 계산된 연령 구간을 인덱스로 붙인다", () => {
    const rows = analysis.daeun.periods.map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook?.rows).toHaveLength(rows.length);
    expect(c.daeunOutlook?.rows[0].range).toMatch(/^\d+–\d+세$/);
    expect(c.daeunOutlook?.rows[0].title).toBe("t0");
  });

  it("대운 서술이 계산 개수보다 많으면 자른다", () => {
    const rows = [...analysis.daeun.periods, ...analysis.daeun.periods]
      .slice(0, 12)
      .map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook?.rows.length).toBe(analysis.daeun.periods.length);
  });

  it("대운 서술이 계산 개수보다 적으면 섹션을 버린다 (인덱스가 어긋난다)", () => {
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows: [{ title: "t", desc: "d" }], summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook).toBeUndefined();
  });

  // luck.ts 의 startAge 는 "세는 나이" 기준이다. evidence.ts(Task 9)에서 만 나이로 비교하다
  // 오프바이원 버그가 났던 것과 동일한 함정이 여기 age 계산에도 있다 — 두 구현이 독립적으로
  // 같은 규칙을 따르는지, "몇 개가 켜지는가"가 아니라 "어느 구간이 켜지는가"로 검증한다.
  describe("대운 now 판정 — 세는 나이 경계", () => {
    const targetPeriod = analysis.daeun.periods[1]; // 두 번째 대운
    const birthYear = analysis.chart.solar.year;
    const firstYear = birthYear + targetPeriod.startAge - 1;

    it("구간 첫 세는 나이 해에는 해당 대운 행만 now 로 표시한다 (range 로 신원을 확인)", () => {
      const rows = analysis.daeun.periods.map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
      const c = toReportContent(
        analysis,
        { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
        meta,
        firstYear,
      );
      const flagged = c.daeunOutlook?.rows.filter((r) => r.now) ?? [];
      expect(flagged).toHaveLength(1);
      expect(flagged[0].range).toBe(`${targetPeriod.startAge}–${targetPeriod.startAge + 9}세`);
    });

    it("toReportContent 의 now 판정은 toChartEvidence 와 같은 대운을 가리킨다", () => {
      const rows = analysis.daeun.periods.map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
      const c = toReportContent(
        analysis,
        { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
        meta,
        firstYear,
      );
      const reportFlaggedIndex = c.daeunOutlook?.rows.findIndex((r) => r.now);
      const evidenceFlaggedIndex = toChartEvidence(analysis, firstYear).daeunStrip.findIndex(
        (d) => d.now,
      );
      expect(reportFlaggedIndex).toBe(evidenceFlaggedIndex);
    });
  });
});
