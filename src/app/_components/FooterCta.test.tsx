import { renderToStaticMarkup } from "react-dom/server";
import { FooterCta } from "./FooterCta";

test("법률 페이지 링크 3개를 노출한다", () => {
  const html = renderToStaticMarkup(<FooterCta />);
  expect(html).toContain('href="/terms"');
  expect(html).toContain('href="/privacy"');
  expect(html).toContain('href="/business"');
  expect(html).toContain("개인정보처리방침");
});
