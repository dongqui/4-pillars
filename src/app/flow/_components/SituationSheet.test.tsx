import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SituationSheet } from "./SituationSheet";

const option = (tag: "지난" | "올해" | "다가올") =>
  ({ year: 2025, tag, range: "2025.2.3 – 2026.2.4", age: 32, owned: false, flowId: null }) as never;

const render = (tag: "지난" | "올해" | "다가올") =>
  renderToStaticMarkup(
    <SituationSheet name="동진" option={option(tag)} busy={false} failure={null} onSubmit={() => {}} onClose={() => {}} />,
  );

describe("SituationSheet", () => {
  it("칩 3줄과 안내 줄", () => {
    const html = render("올해");
    for (const t of ["현재 직업", "연애 상태", "가장 궁금한 것", "가사 · 돌봄", "썸", "대인관계", "답변은 이 리포트를 쓰는 데만 쓰이고"])
      expect(html).toContain(t);
  });

  it("지난 해 문구", () => {
    expect(render("지난")).toContain("선택한 해가 시작될 무렵의 상황을 알려주세요");
    expect(render("올해")).toContain("지금의 상황을 기준으로 설명을 맞춰요");
  });

  it("처음엔 버튼이 잠겨 있다", () => {
    expect(render("올해")).toMatch(/리포트 만들기<\/button>/);
    expect(render("올해")).toMatch(/<button[^>]*disabled=""[^>]*>리포트 만들기/);
  });
});
