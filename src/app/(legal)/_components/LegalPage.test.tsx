import { renderToStaticMarkup } from "react-dom/server";
import { LegalPage } from "./LegalPage";

test("제목·개정일·본문을 렌더한다", () => {
  const html = renderToStaticMarkup(
    <LegalPage title="이용약관" updatedAt="2026-08-12">
      <p>본문 문단</p>
    </LegalPage>,
  );
  expect(html).toContain("이용약관");
  expect(html).toContain("최종 개정일");
  expect(html).toContain("2026-08-12");
  expect(html).toContain("본문 문단");
});
