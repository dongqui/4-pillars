import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "./page";

test("청약철회 제한과 회사 귀책 환불 예외를 고지한다", () => {
  const html = renderToStaticMarkup(<TermsPage />);
  expect(html).toContain("청약철회");
  expect(html).toContain("즉시 제공");
  expect(html).toContain("회사의 귀책");
  expect(html).toContain("hailmarylabs@gmail.com");
});
