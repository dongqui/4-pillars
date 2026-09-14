import { describe, expect, it } from "vitest";
import {
  JOB_OPTIONS,
  LOVE_OPTIONS,
  flowSituationSchema,
  jobLabel,
  loveLabel,
  toSituation,
} from "./situation";

describe("flowSituationSchema", () => {
  it("정의역 안의 값을 받는다", () => {
    expect(flowSituationSchema.safeParse({ job: "employed", love: "single" }).success).toBe(
      true,
    );
  });

  it("정의역 밖 값은 거절한다", () => {
    expect(flowSituationSchema.safeParse({ job: "백수", love: "single" }).success).toBe(false);
  });

  it("모르는 키는 거절한다 — 화면이 보낸 오타가 조용히 저장되지 않는다", () => {
    expect(
      flowSituationSchema.safeParse({ job: "employed", love: "single", mood: "좋음" }).success,
    ).toBe(false);
  });

  it("한쪽만 있으면 거절한다 — 두 축 모두 고른 뒤에만 제출된다", () => {
    expect(flowSituationSchema.safeParse({ job: "employed" }).success).toBe(false);
  });
});

describe("라벨", () => {
  // 라벨 표를 Object.fromEntries 로 만들어 놓아, 선택지를 추가하고 표를 안 고치면
  // 타입이 아니라 undefined 로 새어 나간다. 그 구멍을 여기서 막는다.
  it("모든 선택지에 라벨이 있다", () => {
    for (const o of JOB_OPTIONS) expect(jobLabel(o.value)).toBe(o.label);
    for (const o of LOVE_OPTIONS) expect(loveLabel(o.value)).toBe(o.label);
  });

  it("두 축 모두 거절 선택지를 갖는다 — 건너뛰기 대신 값으로 받는다", () => {
    expect(JOB_OPTIONS.some((o) => o.value === "undisclosed")).toBe(true);
    expect(LOVE_OPTIONS.some((o) => o.value === "undisclosed")).toBe(true);
  });
});

describe("toSituation", () => {
  it("객체를 그대로 읽는다", () => {
    expect(toSituation({ job: "student", love: "crushing" })).toEqual({
      job: "student",
      love: "crushing",
    });
  });

  it("JSON 문자열도 읽는다 — 드라이버가 파싱해 주지 않는 경우가 있다", () => {
    expect(toSituation('{"job":"student","love":"crushing"}')).toEqual({
      job: "student",
      love: "crushing",
    });
  });

  it("NULL 은 null 이다 — 이 기능 전에 만들어진 흐름이다", () => {
    expect(toSituation(null)).toBeNull();
  });

  it("모양이 어긋나면 null 로 접는다 — months 와 달리 없어도 리포트는 그려진다", () => {
    expect(toSituation({ job: "백수" })).toBeNull();
    expect(toSituation("{{")).toBeNull();
  });
});
