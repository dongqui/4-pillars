import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { buildFlowContext } from "./facts";
import { buildFlowSectionRequest, FLOW_SYSTEM_PROMPT } from "./index";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

function ctxOf(year = 2027) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year));
}

describe("FLOW_SYSTEM_PROMPT", () => {
  it("시제 중립을 요구한다", () => {
    expect(FLOW_SYSTEM_PROMPT).toContain("시제");
  });

  it("구간 이야기를 더 이상 하지 않는다", () => {
    // 구간이 사라졌는데 프롬프트에 남아 있으면 LLM 이 없는 구간을 지어낸다
    expect(FLOW_SYSTEM_PROMPT).not.toContain("구간 번호");
  });
});

describe("buildFlowSectionRequest", () => {
  it("사실 블록과 섹션 지시문을 함께 낸다", () => {
    const req = buildFlowSectionRequest(ctxOf(), "months");
    expect(req.user).toContain("[연간]");
    expect(req.user).toContain("[1번째 달]");
    expect(req.user).toContain("[요청 · months]");
  });

  it("08 의 스키마에 계산된 변곡점만 들어간다", () => {
    const ctx = ctxOf();
    const req = buildFlowSectionRequest(ctx, "pivots");
    const json = JSON.stringify(req.inputSchema);
    // 계산되지 않은 달이 정의역에 있으면 LLM 이 그 달을 쓸 수 있다
    for (let i = 1; i <= 12; i += 1) {
      if (ctx.pivotMonths.includes(i)) continue;
      expect(json).not.toContain(`"const":${i}`);
    }
  });

  // 위 테스트는 배제만 본다 — ctx.pivotMonths 의 앞부분만 스키마에 실려도
  // (예: slice(0, 1)) 통과한다. 아래는 포함 방향도 함께 본다: 계산된 변곡점이
  // *전부* 정의역에 있는가, 그리고 그 개수가 정확히 일치하는가(중복으로 못 채운다).
  //
  // monthList(sections/registry.ts)는 정의역 크기에 따라 다른 코드 경로를 탄다
  // — 0개는 z.never() 배열, 1개는 z.literal 단일값(z.union 은 최소 2개를
  // 요구해서 못 씀), 2개 이상은 z.union → JSON Schema 의 anyOf. 세 갈래를 실제
  // 생년으로 재현한다 — 손으로 FlowContext 를 지어내면 buildFlowContext 를
  // 우회해 실제 배선(facts.ts → sections/registry.ts)을 안 타게 된다.
  //
  // 이 파일의 BIRTH(1993-04-12)는 2000~2039년 어디서도 변곡점 0개를 내지
  // 않았다(npx tsx 로 flowMonths 를 직접 스윕해 확인 — scripts/flow-threshold.mts
  // 가 쓰는 것과 같은 방식). 0개는 pivots.ts 주석이 말하듯 구조적으로 가능한
  // 값이라(PIVOT_THRESHOLD=0.93 에서 표본의 4.20%), 같은 스윕으로 실제 0개를
  // 내는 생년을 찾아 썼다 — pivots.ts 168행 주석이 이미 예시로 쓰는 "시간
  // 미상" 표본(1985-06-20, 여성)이다.
  describe("08 스키마 정의역 — 계산된 변곡점과 정확히 일치한다", () => {
    const BIRTH_NO_HOUR = {
      year: 1985, month: 6, day: 20,
      hour: undefined, minute: undefined,
      gender: "female", calendar: "solar",
    } as const;

    const cases = [
      { label: "0개 — z.never() 배열", birth: BIRTH_NO_HOUR, year: 2001, expectedCount: 0 },
      { label: "1개 — z.literal 단일값(union 아님)", birth: BIRTH, year: 2027, expectedCount: 1 },
      { label: "3개 — z.union → anyOf", birth: BIRTH, year: 2021, expectedCount: 3 },
    ];

    it.each(cases)("$label", ({ birth, year, expectedCount }) => {
      const a = analyze(birth);
      const fm = flowMonths(a, year);
      const ctx = buildFlowContext(a, year, fm);
      // 고른 (생년, 연도) 조합이 의도한 arity 를 실제로 내는지 먼저 확인한다 —
      // 아니면 아래 어느 쪽 방향 검사든 우연히 통과할 수 있다.
      expect(ctx.pivotMonths).toHaveLength(expectedCount);

      const req = buildFlowSectionRequest(ctx, "pivots");
      const json = JSON.stringify(req.inputSchema);
      const found = [...json.matchAll(/"const":(\d+)/g)].map((m) => Number(m[1]));

      // 포함 방향: 계산된 변곡점은 전부 정의역에 있다
      for (const m of ctx.pivotMonths) expect(found).toContain(m);
      // 배제 + 개수 방향: 정의역이 정확히 그 집합이다 — 다중집합으로 비교해
      // 중복으로 개수만 채우는 경우(예: 같은 달 두 번)도 잡는다
      expect(found.slice().sort((x, y) => x - y)).toEqual(
        ctx.pivotMonths.slice().sort((x, y) => x - y),
      );
    });
  });

  it("모든 섹션이 요청을 만들 수 있다", () => {
    const ctx = ctxOf();
    for (const key of ["overview","rising","straining","work","relating","money","months","pivots","closing"] as const) {
      const req = buildFlowSectionRequest(ctx, key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.inputSchema, key).toBeTruthy();
    }
  });
});
