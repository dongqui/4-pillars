import { describe, expect, it } from "vitest";
import { safeParseFlowSectionContent, shapeOf } from "./derive";

/**
 * 이 파일이 지키는 것은 "검증에 걸린다" 가 아니라 **걸린 이유가 로그에 남는다** 다.
 *
 * 예전에는 실패가 null 하나로 뭉개져서, 화면에서 섹션이 사라지는 것을 매번 보면서도
 * 서버 로그에는 "버림: rising" 밖에 없었다. 그래서 여기서 확인하는 것은 reason 이
 * 비어 있지 않다는 것이 아니라, **어느 필드가 문제인지 이름이 들어 있다는 것**이다.
 */
describe("safeParseFlowSectionContent · 실패 이유", () => {
  it("items 개수가 틀리면 어느 필드인지 말한다", () => {
    const three = { title: "가", body: "나" };
    const r = safeParseFlowSectionContent("rising", {
      lead: "가",
      items: [three, three, three, three],
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("items");
  });

  it("07 이 정의역 밖의 달을 집으면 그 자리를 짚는다", () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i + 1,
      title: `t${i}`,
      body: `b${i}`,
    }));
    months[0].monthIndex = 13;
    const r = safeParseFlowSectionContent("months", { lead: "가", months });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    // 몇 번째 원소의 어느 필드인지까지 나와야 한다 — "months 가 틀렸다" 로는
    // 12개 중 어느 것이 문제인지 모른다.
    expect(r.reason).toContain("months.0.monthIndex");
  });

  it("통과하면 content 를 그대로 돌려준다", () => {
    const content = { lead: "가", body: "나" };
    const r = safeParseFlowSectionContent("work", content);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content).toEqual(content);
  });
});

describe("shapeOf", () => {
  it("배열은 길이와 첫 원소의 모양으로 줄인다", () => {
    // 개수 문제가 로그 한 줄로 보여야 한다는 것이 이 함수의 존재 이유다.
    expect(shapeOf({ lead: "12345", items: [{ title: "가", body: "나다" }] })).toBe(
      "{ lead: str(5), items: [1] { title: str(1), body: str(2) } }",
    );
  });

  it("서술 본문을 그대로 담지 않는다", () => {
    // 사용자가 돈 주고 산 서술이다. 길이만 남긴다.
    const secret = "여기에 아주 개인적인 해석이 들어 있다";
    expect(shapeOf({ body: secret })).not.toContain(secret);
  });

  it("숫자는 값을 그대로 남긴다 — 어느 달을 집었는지가 보여야 한다", () => {
    expect(shapeOf({ monthIndex: 6 })).toBe("{ monthIndex: 6 }");
  });

  it("빈 배열도 길이를 보인다", () => {
    expect(shapeOf({ months: [] })).toBe("{ months: [0] }");
  });
});
