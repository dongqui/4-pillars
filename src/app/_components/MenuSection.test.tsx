import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuSection } from "./MenuSection";

test("파는 것 전부와 가격이 한 화면에 있다", () => {
  const html = renderToStaticMarkup(<MenuSection />);
  for (const [title, href] of [
    ["성향 리포트", "/report"],
    ["두 사람 궁합", "/match"],
    ["고민상담", "/consult"],
  ]) {
    expect(html).toContain(title);
    expect(html).toContain(`href="${href}"`);
  }
  expect(html).toContain("1,000원");
});

test("무료 항목도 링크다 — 캐릭터는 퍼널로, 관계 지도는 /map 으로", () => {
  const html = renderToStaticMarkup(<MenuSection />);
  expect(html).toContain('href="/funnel?step=name"');
  expect(html).toContain('href="/map"');
  expect(html).toContain("무료");
});
