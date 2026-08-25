import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportBody } from "./ReportBody";
import { sampleReport } from "../_lib/report-content.fixture";

describe("ReportBody 화면 순서", () => {
  // registry.ts 의 SECTIONS 선언 순서가 번호를 만들고(derive.ts: sectionHeading),
  // 여기 JSX 순서가 실제 화면을 만든다 — 둘은 서로 다른 파일이라 타입 체크가
  // 어긋남을 잡아주지 않는다. SectionHeading 이 "no · category" 를 그대로 찍으므로
  // 렌더된 HTML 에서 그 문자열이 등장하는 위치를 비교해 화면 순서를 직접 검증한다.
  it("잠금 해제 상태에서 유료 섹션이 레지스트리 번호 순서대로 나온다", () => {
    const html = renderToStaticMarkup(
      <ReportBody content={sampleReport} access={{ isLoggedIn: true, isUnlocked: true }} />,
    );

    const expectedOrder = [
      "05 · 감정과 스트레스",
      "06 · 잘 맞는 환경",
      "07 · 사람을 대하는 방식",
      "08 · 연애와 관계",
      "09 · 궁합",
      "10 · 재물",
    ];

    const positions = expectedOrder.map((needle) => html.indexOf(needle));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `"${expectedOrder[i]}" 가 화면에 없다`).toBeGreaterThan(-1);
    }
    expect(positions, "화면 순서가 번호 순서와 어긋난다").toEqual(
      [...positions].sort((a, b) => a - b),
    );
  });
});
