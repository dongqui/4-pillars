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

test("화면이 없는 관계 지도는 링크가 아니라 '준비 중' 이다", () => {
  const html = renderToStaticMarkup(<MenuSection />);
  expect(html).toContain("관계 지도");
  expect(html).toContain("준비 중");
  // /map 은 아직 없는 라우트다 — 랜딩에서 눌리면 곧바로 404 를 본다
  expect(html).not.toContain('href="/map"');
});
