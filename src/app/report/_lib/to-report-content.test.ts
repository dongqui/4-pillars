import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import {
  SECTION_KEYS,
  type Interpretation,
  type SectionKey,
} from "@/app/api/saju/_lib/sections";
import type { ReportContent } from "./report-content";
import { toReportContent } from "./to-report-content";

const analysis = analyze({ year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male" });
const meta = { name: "홍길동", birthLine: "양력 1990.02.20 04:30" };

const traits = [1, 2, 3, 4].map((n) => ({
  title: `t${n}`,
  body: `b${n}`,
  basis: `근거${n}`,
}));

const overview = { headline: "헤드라인", summary: "요약", traits };
const outerVsInner = { outward: "겉", inner: "속" };
const strengths = [{ title: "s", body: "b" }, { title: "s2", body: "b2" }];
const cautions = { items: ["주의1", "주의2"], tip: "팁" };

const free: Partial<Interpretation> = { overview, outerVsInner, strengths, cautions };

const two = ["하나", "둘"];
const three = ["하나", "둘", "셋"];

/**
 * 13개 섹션이 하나도 빠짐없이 든 해석. Interpretation 은 Partial 이 아니라
 * 전 섹션 필수라, 레지스트리에 섹션이 늘면 여기가 타입 체크에서 먼저 걸린다.
 */
const everySection: Interpretation = {
  overview,
  outerVsInner,
  strengths,
  cautions,
  emotion: [{ label: "감정 라벨", body: "감정 본문" }],
  decisions: {
    deciding: "결정 본문",
    venturing: "기회 본문",
    unsure: "확신 본문",
    afterDeciding: "결정 뒤 본문",
  },
  workStyle: {
    starting: "착수 본문",
    progressing: "진행 본문",
    collaborating: "협업 본문",
    troubled: "난관 본문",
    performing: "성과 본문",
  },
  environment: {
    energizing: three,
    draining: three,
    summary: "환경 요약",
    emphasis: "환경 강조",
    roles: three,
    roleNote: "역할 설명",
  },
  relating: [{ label: "관계 라벨", value: "관계 값" }],
  love: [{ label: "연애 라벨", body: "연애 본문" }],
  compatibility: { good: two, clash: two },
  wealth: {
    points: [{ label: "재물 라벨", body: "재물 본문" }],
    summary: "재물 요약",
    emphasis: "재물 강조",
  },
  playbook: [1, 2, 3, 4].map((n) => ({ title: `실천${n}`, body: `본문${n}` })),
};

/**
 * 섹션 키 → 그 섹션이 뷰모델에서 앉는 자리. 목록을 손으로 적지 않고
 * Record<SectionKey, _> 로 두는 이유는 위 everySection 과 같다 — 레지스트리에
 * 섹션이 늘면 이 표를 채우기 전까지 타입 체크가 통과하지 않는다.
 *
 * overview 와 cautions 만 함수가 값을 다시 조립한다. 둘은 같은 이름으로 옮겨지지
 * 않고 상단 필드(headline·summary·personality, cautions·cautionTip)로 펴지기 때문이다.
 */
const landing: { [K in SectionKey]: (c: ReportContent) => unknown } = {
  overview: (c) => ({ headline: c.headline, summary: c.summary, traits: c.personality }),
  outerVsInner: (c) => c.outerVsInner,
  strengths: (c) => c.strengths,
  cautions: (c) => ({ items: c.cautions, tip: c.cautionTip }),
  emotion: (c) => c.emotion,
  decisions: (c) => c.decisions,
  workStyle: (c) => c.workStyle,
  environment: (c) => c.environment,
  relating: (c) => c.relating,
  love: (c) => c.love,
  compatibility: (c) => c.compatibility,
  wealth: (c) => c.wealth,
  playbook: (c) => c.playbook,
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

  // toReportContent 의 객체 리터럴은 전 필드가 옵셔널인 ReportContent 를 만든다 —
  // 한 줄을 지워도 타입 체크가 통과한다. 실제로 playbook 줄을 지웠을 때 tsc 도
  // 나머지 테스트도 전부 초록이었고, ReportBody.test 는 픽스처를 직접 렌더해
  // 이 이음매를 지나지 않아 13번 섹션이 조용히 사라졌다. 그 한 줄을 여기서 막는다.
  it("레지스트리의 모든 섹션이 뷰모델에 옮겨진다", () => {
    const c = toReportContent(analysis, everySection, meta, 2026);
    for (const key of SECTION_KEYS) {
      expect(landing[key](c), `${key} 섹션이 뷰모델에 옮겨지지 않았다`).toEqual(
        everySection[key],
      );
    }
  });
});
