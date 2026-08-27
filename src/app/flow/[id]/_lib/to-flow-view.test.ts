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
    const out = toFlowView({
      closing: { lead: "l", items: [], closing: "c" },
      overview: { title: "t", body: "b", keywords: [] },
    } as never);
    expect(out[0].key).toBe("overview");
  });
});
