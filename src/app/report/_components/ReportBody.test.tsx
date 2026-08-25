import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PAID_SECTION_KEYS, sectionHeading } from "@/app/api/saju/_lib/sections";
import { ReportBody } from "./ReportBody";
import { sampleReport } from "../_lib/report-content.fixture";

describe("ReportBody 화면 순서", () => {
  // registry.ts 의 SECTIONS 선언 순서가 번호를 만들고(derive.ts: sectionHeading),
  // 여기 JSX 순서가 실제 화면을 만든다 — 둘은 서로 다른 파일이라 타입 체크가
  // 어긋남을 잡아주지 않는다. SectionHeading 이 "no · category" 를 그대로 찍으므로
  // 렌더된 HTML 에서 그 문자열이 등장하는 위치를 비교해 화면 순서를 직접 검증한다.
  //
  // 기대 순서는 여기 손으로 적지 않고 PAID_SECTION_KEYS/sectionHeading() 에서
  // 뽑는다 — 손으로 적으면 Task 5~7 이 섹션을 끼워 넣을 때마다 이 배열도 같이
  // 고쳐야 하고, 안 고치면 "레지스트리가 옮겨갔다"가 아니라 "문자열이 화면에
  // 없다"는 엉뚱한 실패로만 드러난다. registry.ts 를 유일한 정답으로 두면
  // 섹션이 늘어나도 이 테스트는 손댈 필요가 없다.
  it("잠금 해제 상태에서 유료 섹션이 레지스트리 번호 순서대로 나온다", () => {
    const html = renderToStaticMarkup(
      <ReportBody content={sampleReport} access={{ isLoggedIn: true, isUnlocked: true }} />,
    );

    const expectedOrder = PAID_SECTION_KEYS.map((key) => {
      const { no, category } = sectionHeading(key);
      return `${no} · ${category}`;
    });

    const positions = expectedOrder.map((needle) => html.indexOf(needle));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `"${expectedOrder[i]}" 가 화면에 없다`).toBeGreaterThan(-1);
    }
    expect(positions, "화면 순서가 레지스트리 순서와 어긋난다").toEqual(
      [...positions].sort((a, b) => a - b),
    );
  });
});
