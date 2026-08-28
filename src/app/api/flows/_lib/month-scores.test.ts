import { describe, expect, it } from "vitest";
import {
  analyze,
  daeunSwitchIn,
  flowYearOf,
  monthTermsOf,
  sewunPillars,
  type Branch,
} from "@/lib/saju-core";
import { frictionOf, parsePillar2 } from "./score";
import { currentDaeun, monthScores } from "./month-scores";

const BIRTH = {
  year: 1993,
  month: 4,
  day: 12,
  hour: 9,
  minute: 20,
  gender: "male",
  calendar: "solar",
} as const;

describe("monthScores", () => {
  it("한 해에 정확히 12개를 낸다", () => {
    expect(monthScores(analyze(BIRTH), 2027)).toHaveLength(12);
  });

  it("index 는 1부터 12까지 순서대로다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    expect(scores.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("두 축은 -1…+1 언저리에 있다", () => {
    for (const s of monthScores(analyze(BIRTH), 2027)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(1.5);
    }
  });

  it("관계 목록과 십성 그룹을 함께 싣는다 — 월별 서술의 재료다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    // 12개 달 중 최소 하나는 원국·세운·대운과 관계를 맺는다
    expect(scores.some((s) => s.interactions.length > 0)).toBe(true);
    for (const s of scores) {
      expect(s.tenGods.length).toBeGreaterThan(0);
      expect(Array.isArray(s.interactions)).toBe(true);
      expect(typeof s.samhap).toBe("boolean");
    }
  });

  it("같은 입력이면 같은 결과다", () => {
    const a = monthScores(analyze(BIRTH), 2027);
    const b = monthScores(analyze(BIRTH), 2027);
    expect(a.map((s) => s.support)).toEqual(b.map((s) => s.support));
    expect(a.map((s) => s.friction)).toEqual(b.map((s) => s.friction));
  });

  it("시간 미상 프로필도 12개를 낸다", () => {
    // BirthInput.hour/minute 는 optional number 다(chart.ts) — "미상" 은
    // undefined 로 표현하지 null 이 아니다. hasHour = input.hour !== undefined
    // 판정이라 null 을 넣으면 오히려 "시간 있음" 취급된다.
    const noHour = analyze({ ...BIRTH, hour: undefined, minute: undefined });
    expect(monthScores(noHour, 2027)).toHaveLength(12);
  });
});

describe("currentDaeun", () => {
  it("그 구간 시작보다 이르거나 같은 전환 중 가장 늦은 회차를 고른다", () => {
    const a = analyze(BIRTH);
    const period = flowYearOf(2027);
    const picked = currentDaeun(a, period);

    // 유도(독립 계산, currentDaeun 의 루프를 재사용하지 않는다):
    //   startAgePrecise = 2.4136834032833576, periods[i].startAge(반올림) = 2,12,22,…
    //   birthInstant = 1993-04-12T00:20:00Z (KST 09:20 → UTC)
    //   period.start(2027 입춘)  = 2027-02-04T01:42:10.489Z
    //   elapsed = (period.start − birthInstant) / YEAR_MS ≈ 33.815 세
    //   회차별 문턱(startAgePrecise + i×10): 2.41 · 12.41 · 22.41 · 32.41 · 42.41 …
    //   33.815 는 32.41(i=3) 을 넘고 42.41(i=4) 은 못 넘는다 → periods[3] (4회차·임자)
    expect(picked).toBe(a.daeun.periods[3]);
    expect(picked.pillar).toBe("임자");
  });

  it("유년기 대운으로 물러서지 않는다", () => {
    // 오름차순 배열에 find(p => p.startAge <= age) 를 쓰면 첫 칸(유년기)이 나온다.
    const a = analyze(BIRTH);
    const picked = currentDaeun(a, flowYearOf(2027));
    expect(picked).not.toBe(a.daeun.periods[0]);
  });
});

// 리뷰 발견(2026-08-26): currentDaeun 이 한때 반올림된 세는 나이
// (periods[i].startAge)로 "지금 대운"을 근사했다. daeunSwitchIn 은 처음부터
// startAgePrecise + i×10 의 정밀 시각을 썼으므로 둘이 최대 반년 어긋날 수 있고,
// 하필 daeunSwitchIn 이 "이 해엔 전환 없음"이라 답한 경계 해 바로 옆에서 어긋나면
// currentDaeun 이 이웃 회차를 조용히 골라 그 해 전체의 friction 대상이 틀어진다.
// 아래 생년은 그 불일치가 실제로 벌어졌던 실측 사례다(구 segments.test.ts, 커밋
// 5152f86) — 2012년(명리 연도) 안에 대운 전환이 있고, 반올림 근사는 그 직전 해
// (2011)에도 전환 이후 회차를 잘못 골랐다.
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
  const beforeYear = switchFlowYear - 1;
  const afterYear = switchFlowYear + 1;

  const sw = daeunSwitchIn(boundarySubject, flowYearOf(switchFlowYear))!;

  it("전환이 든 해를 확인한다 — 전후 회차는 이웃한 회차고, 앞뒤 해엔 전환이 없다", () => {
    expect(sw).not.toBeNull();
    expect(sw.after.index).toBe(sw.before.index + 1);
    // beforeYear/afterYear 둘 다 daeunSwitchIn 이 null 이어야 currentDaeun 경로가
    // 실제로 걸린다 — 걸리지 않으면 아래 두 테스트는 아무 것도 증명하지 못한다.
    expect(daeunSwitchIn(boundarySubject, flowYearOf(beforeYear))).toBeNull();
    expect(daeunSwitchIn(boundarySubject, flowYearOf(afterYear))).toBeNull();
  });

  it("currentDaeun 은 전환 바로 전해엔 이전 회차를, 바로 다음해엔 다음 회차를 정밀 시각 기준으로 고른다", () => {
    // 유도: daeunSwitchIn 은 currentDaeun 과 독립된 조건문으로 같은 정밀식을 잰다.
    // switchFlowYear 안에 전환이 있고 beforeYear·afterYear 둘 다 "전환 없음"이라면,
    // beforeYear 시작 시점엔 아직 sw.before 가, afterYear 시작 시점엔 이미 sw.after
    // 가 적용 중이어야 한다 — 그 사이엔 다른 전환이 없으므로.
    expect(currentDaeun(boundarySubject, flowYearOf(beforeYear))).toBe(sw.before);
    expect(currentDaeun(boundarySubject, flowYearOf(afterYear))).toBe(sw.after);
  });

  it("그 선택이 그 해 전체의 friction 대상에 실제로 반영된다 — monthScores 로 간접 검증", () => {
    // frictionTargets 는 daeunSwitchIn 이 null 인 해에서만 currentDaeun 을 탄다
    // (month-scores.ts 의 frictionTargets 참고). expectedFirstMonthFriction 은 같은
    // natal·sewun 을 두고 daeun 지만 바꿔 frictionOf 로 독립 계산한다 — frictionOf
    // 는 이미 weightTotal(targets) 로 정규화하므로 여기서 상수를 베끼지 않는다.
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

    const actualBefore = monthScores(boundarySubject, beforeYear)[0].friction;
    const actualAfter = monthScores(boundarySubject, afterYear)[0].friction;

    // 반올림 나이 근사(수정 전)는 beforeYear 에 sw.after.branch 를 잘못 골랐다 —
    // 아래 toBeCloseTo 는 sw.before/after 를 뒤바꾸면 실패한다.
    expect(actualBefore).toBeCloseTo(expectedFirstMonthFriction(beforeYear, sw.before.branch));
    expect(actualAfter).toBeCloseTo(expectedFirstMonthFriction(afterYear, sw.after.branch));
  });
});
