import { describe, expect, it } from "vitest";
import type { FlowSegmentBody } from "@/app/api/flows/_lib/sections";
import { toFlowView } from "./to-flow-view";

// 브리프 원문은 segmentId 를 string 으로 두었다 — vitest 는 타입체크를 하지 않아
// 테스트는 그대로 통과하지만, npm run typecheck 은 FlowSegmentBody.segmentId 가
// SegmentId 유니언이라 이 리터럴을 거부한다. 테스트 쪽(더 작은 쪽)을 고쳐 맞춘다.
const body = (id: string): FlowSegmentBody =>
  ({ segmentId: id, title: `제목-${id}`, body: `본문-${id}` }) as FlowSegmentBody;

describe("toFlowView", () => {
  it("현재 구간의 서술을 고른다", () => {
    const view = toFlowView(
      { now: { common: "배경", segments: [body("segment_1"), body("segment_2")] } },
      1,
    );
    expect(view[0].current?.title).toBe("제목-segment_2");
    expect(view[0].common).toBe("배경");
  });

  it("07 은 common 이 없고 전체 타임라인을 준다", () => {
    const view = toFlowView({ ahead: { segments: [body("segment_1")] } }, 0);
    const ahead = view.find((v) => v.key === "ahead")!;
    expect(ahead.common).toBeNull();
    expect(ahead.all).toHaveLength(1);
  });

  it("01~06·08 처럼 common 이 있는 섹션도 all 에 전체 구간을 그대로 담는다", () => {
    // all 은 07(ahead) 전용이 아니다 — FlowBody 가 common 이 있는 섹션에서는 지금
    // 안 써도, toFlowView 자체는 "전체 구간" 이라는 계약을 모든 섹션에 똑같이
    // 지켜야 한다. 이걸 07 에서만 검증하면 다른 섹션에서 all 이 비거나 잘려도
    // 잡히지 않는다.
    const view = toFlowView(
      { now: { common: "배경", segments: [body("segment_1"), body("segment_2")] } },
      0,
    );
    expect(view[0].all).toEqual([body("segment_1"), body("segment_2")]);
  });

  it("없는 섹션은 빼고 낸다 — 생성이 일부 실패해도 나머지는 보인다", () => {
    expect(toFlowView({}, 0)).toEqual([]);
  });

  it("인덱스가 범위를 벗어나면 마지막 칸으로 눕힌다", () => {
    const view = toFlowView({ now: { common: "c", segments: [body("segment_1")] } }, 5);
    expect(view[0].current?.segmentId).toBe("segment_1");
  });

  it("인덱스가 음수여도 첫 칸으로 눕힌다", () => {
    // Math.max(index, 0) 이 다루는 경로 — 위 테스트(범위 초과)가 Math.min 쪽을
    // 검증하니, 이 테스트가 없으면 Math.max 쪽은 구현이 지워져도 안 잡힌다.
    const view = toFlowView(
      { now: { common: "c", segments: [body("segment_1"), body("segment_2")] } },
      -1,
    );
    expect(view[0].current?.segmentId).toBe("segment_1");
  });
});
