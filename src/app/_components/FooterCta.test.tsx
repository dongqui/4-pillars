import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FooterCta } from "./FooterCta";

test("법률 링크와 사업자정보를 노출한다", () => {
  const html = renderToStaticMarkup(<FooterCta displayName={null} />);
  // 이용약관·개인정보처리방침은 링크로 유지
  expect(html).toContain('href="/terms"');
  expect(html).toContain('href="/privacy"');
  expect(html).toContain("개인정보처리방침");
  // 사업자정보는 링크가 아니라 본문에 직접 노출
  expect(html).not.toContain('href="/business"');
  expect(html).toContain("프로젝트엔");
  expect(html).toContain("432-33-01882");
  expect(html).toContain("projectn.contact@gmail.com");
});

test("전화번호는 우리가 직접 tel 링크로 건다 — 브라우저 자동 인식에 기대지 않는다", () => {
  const html = renderToStaticMarkup(<FooterCta displayName={null} />);
  expect(html).toContain('href="tel:070-8095-3631"');
});
