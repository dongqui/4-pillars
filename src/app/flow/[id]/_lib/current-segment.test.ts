import { describe, expect, it } from "vitest";
import { currentSegmentIndex, segmentLabel } from "./current-segment";

const segments = [
  { id: "segment_1" as const, start: "2026-02-04T00:00:00Z", end: "2026-08-07T00:00:00Z", basis: "연시작" as const },
  { id: "segment_2" as const, start: "2026-08-07T00:00:00Z", end: "2027-02-04T00:00:00Z", basis: "월운전환" as const },
];

describe("currentSegmentIndex", () => {
  it("지금이 속한 칸을 고른다", () => {
    expect(currentSegmentIndex(segments, new Date("2026-03-01T00:00:00Z"))).toBe(0);
    expect(currentSegmentIndex(segments, new Date("2026-11-01T00:00:00Z"))).toBe(1);
  });

  it("경계는 닫힌-열린 구간이다", () => {
    expect(currentSegmentIndex(segments, new Date("2026-08-07T00:00:00Z"))).toBe(1);
  });

  it("기간이 지난 뒤에도 마지막 칸을 준다 — 산 리포트는 계속 볼 수 있어야 한다", () => {
    expect(currentSegmentIndex(segments, new Date("2028-01-01T00:00:00Z"))).toBe(1);
  });

  it("기간 전이면 첫 칸이다", () => {
    expect(currentSegmentIndex(segments, new Date("2025-01-01T00:00:00Z"))).toBe(0);
  });

  it("ISO 문자열을 instant 로 되돌려 비교한다 — 오프셋 표기가 달라도 맞는다", () => {
    const offset = [
      { ...segments[0], end: "2026-08-07T09:00:00+09:00" },
      { ...segments[1], start: "2026-08-07T09:00:00+09:00" },
    ];
    expect(currentSegmentIndex(offset, new Date("2026-08-07T00:30:00Z"))).toBe(1);
  });
});

describe("segmentLabel", () => {
  it("첫 구간은 '지금부터' 가 아니라 시작을 말한다", () => {
    expect(segmentLabel(segments[0])).toBe("2월 무렵부터");
  });

  it("계산된 날짜에서 붙인다 — LLM 이 쓴 값이 아니다", () => {
    expect(segmentLabel(segments[1])).toBe("8월 무렵부터");
  });
});
