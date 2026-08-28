import { describe, expect, it } from "vitest";
import { toFlowView } from "./to-flow-view";

describe("toFlowView", () => {
  it("없는 섹션은 빼고 낸다 — 부분 생성도 보여준다", () => {
    const out = toFlowView({
      overview: { title: "t", body: "b", keywords: ["가", "나", "다", "라"] },
    });
    expect(out.map((s) => s.key)).toEqual(["overview"]);
  });

  it("선언 순서를 지킨다", () => {
    // out[0] 만 보면 "삽입 순서 대신 선언 순서를 썼는가" 는 잡아도, 그 사이의
    // 키 하나가 통째로 빠지는 것은 못 잡는다(예: money 가 필터링 로직 오류로
    // 새나가도 out[0]==="overview" 는 여전히 참이다). 전체 순서를 확인한다.
    const out = toFlowView({
      closing: { lead: "l", items: [], closing: "c" },
      money: { lead: "l", body: "b" },
      overview: { title: "t", body: "b", keywords: [] },
    } as never);
    expect(out.map((s) => s.key)).toEqual(["overview", "money", "closing"]);
  });
});
