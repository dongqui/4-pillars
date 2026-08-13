import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FooterCta } from "./FooterCta";

test("법률 링크와 사업자정보를 노출한다", () => {
  const html = renderToStaticMarkup(<FooterCta />);
  // 이용약관·개인정보처리방침은 링크로 유지
  expect(html).toContain('href="/terms"');
  expect(html).toContain('href="/privacy"');
  expect(html).toContain("개인정보처리방침");
  // 사업자정보는 링크가 아니라 본문에 직접 노출
  expect(html).not.toContain('href="/business"');
  expect(html).toContain("헤일메리랩스");
  expect(html).toContain("432-33-01882");
  expect(html).toContain("hailmarylabs@gmail.com");
});
