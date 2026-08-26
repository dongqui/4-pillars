import { describe, expect, it } from "vitest";
import {
  analyze,
  daeunSwitchIn,
  flowYearAt,
  monthTermsOf,
  sewunPillars,
  type Branch,
} from "@/lib/saju-core";
import { frictionOf, parsePillar2 } from "./score";
import { flowSegments, monthScores, SEGMENT_IDS } from "./segments";

const subject = analyze({
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  gender: "male",
  calendar: "solar",
});

describe("monthScores", () => {
  it("12개 월운 전부를 채점한다 — 계산 해상도는 12, 노출은 최대 3", () => {
    expect(monthScores(subject, 2026)).toHaveLength(12);
  });

  it("두 축 다 정규화 범위 안이다", () => {
    for (const s of monthScores(subject, 2026)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(2);
    }
  });
});

describe("flowSegments", () => {
  const segs = flowSegments(subject, 2026);

  it("언제나 1~3개다", () => {
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.length).toBeLessThanOrEqual(3);
  });

  it("id 는 순서대로 붙는다", () => {
    expect(segs.map((s) => s.id)).toEqual(SEGMENT_IDS.slice(0, segs.length));
  });

  it("첫 구간은 연시작이다", () => {
    expect(segs[0].basis).toBe("연시작");
  });

  it("틈도 겹침도 없다 — 한 구간의 end 가 다음 구간의 start 다", () => {
    for (let i = 0; i < segs.length - 1; i += 1) {
      expect(segs[i].end).toBe(segs[i + 1].start);
    }
  });

  it("전체가 그 명리 연도를 덮는다", () => {
    const all = flowSegments(subject, 2026);
    const months = monthScores(subject, 2026);
    expect(all[0].start).toBe(months[0].term.start.toISOString());
    expect(all[all.length - 1].end).toBe(months[11].term.end.toISOString());
  });

  it("구간은 최소 3개월이다", () => {
    const MONTH_MS = 30 * 24 * 3600_000;
    for (const s of segs) {
      expect(Date.parse(s.end) - Date.parse(s.start)).toBeGreaterThanOrEqual(2.5 * MONTH_MS);
    }
  });

  it("같은 입력은 같은 구간을 낸다 — 동점 처리가 결정적이다", () => {
    expect(flowSegments(subject, 2026)).toEqual(flowSegments(subject, 2026));
  });

  it("여러 사람·여러 해를 돌려도 언제나 1~3개다", () => {
    for (const y of [2024, 2025, 2026, 2027]) {
      for (const g of ["male", "female"] as const) {
        const a = analyze({ year: 1985, month: 3, day: 3, hour: 7, minute: 0, gender: g, calendar: "solar" });
        const out = flowSegments(a, y);
        expect(out.length).toBeGreaterThanOrEqual(1);
        expect(out.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

// 리뷰 발견: currentDaeun(targetsFor 내부, 비공개)이 반올림된 세는 나이로 "지금
// 대운"을 근사하면 daeunSwitchIn 의 정밀 시각 판정과 최대 반년 어긋날 수 있다.
// 그 어긋남이 하필 daeunSwitchIn 이 "이 해엔 전환 없음"이라 답한 경계 해에서
// 나면 전환 바로 앞/뒤 해 전체가 이웃 회차의 friction 대상을 쓰게 된다.
//
// 아래 생년은 실측(scripts/_scratch-find-boundary.mts, 커밋 안 함)으로 확인한
// 실제 불일치 사례다: 대운 전환이 2012년(명리 연도) 안에 있고, 반올림 나이
// 근사는 그 직전 해(2011)에도 전환 이후 회차(갑오)를 골랐다 — 실제로는 전환
// 전이므로 이전 회차(계사)를 써야 한다. currentDaeun 을 export 하지 않고
// monthScores(공개 API)의 friction 값으로 간접 검증한다 — score.ts 의 테스트
// 관례(비공개 헬퍼를 위해 export 를 늘리지 않는다)를 따른다.
describe("대운 경계 해 — 대운 선택이 정밀 시각과 어긋나지 않는다", () => {
  const boundarySubject = analyze({
    year: 1950,
    month: 12,
    day: 3,
    hour: 6,
    minute: 0,
    gender: "male",
    calendar: "solar",
  });
  const switchFlowYear = 2012;

  /** targetsFor 와 같은 규칙으로, 대운 지체만 바꿔 그 해 첫 달의 friction 을 독립적으로 계산한다. */
  function expectedFirstMonthFriction(year: number, daeunBranch: Branch): number {
    const term = monthTermsOf(year)[0];
    const p = parsePillar2(term.korean)!;
    const sewun = parsePillar2(sewunPillars(year, 1)[0].korean)!;
    const c = boundarySubject.chart;
    const natal = [c.year.branch, c.month.branch, c.day.branch, c.hour?.branch].filter(
      (b): b is NonNullable<typeof b> => b != null,
    );
    return frictionOf(p.branch, { natal, sewun: sewun.branch, daeun: daeunBranch });
  }

  it("전환이 든 해를 확인한다 — 전후 회차는 이웃한 회차다", () => {
    const period = flowYearAt(new Date(Date.UTC(switchFlowYear, 5, 1)));
    const sw = daeunSwitchIn(boundarySubject, period);
    expect(sw).not.toBeNull();
    expect(sw!.after.index).toBe(sw!.before.index + 1);
  });

  it("전환 바로 전해엔 이전 회차를, 바로 다음해엔 다음 회차를 정밀 시각 기준으로 고른다", () => {
    const period = flowYearAt(new Date(Date.UTC(switchFlowYear, 5, 1)));
    const sw = daeunSwitchIn(boundarySubject, period)!;

    const beforeYear = switchFlowYear - 1;
    const afterYear = switchFlowYear + 1;

    // 두 해 다 daeunSwitchIn 이 null 이어야 currentDaeun 경로가 실제로 걸린다.
    expect(
      daeunSwitchIn(boundarySubject, flowYearAt(new Date(Date.UTC(beforeYear, 5, 1)))),
    ).toBeNull();
    expect(
      daeunSwitchIn(boundarySubject, flowYearAt(new Date(Date.UTC(afterYear, 5, 1)))),
    ).toBeNull();

    const actualBefore = monthScores(boundarySubject, beforeYear)[0].friction;
    const actualAfter = monthScores(boundarySubject, afterYear)[0].friction;

    // 반올림 나이 근사(수정 전)는 beforeYear 에 sw.after.branch 를 잘못 골랐다 —
    // 아래 toBeCloseTo 는 sw.before/after 를 뒤바꾸면 실패한다.
    expect(actualBefore).toBeCloseTo(expectedFirstMonthFriction(beforeYear, sw.before.branch));
    expect(actualAfter).toBeCloseTo(expectedFirstMonthFriction(afterYear, sw.after.branch));
  });
});
