import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeLink } from "./HomeLink";

test("항상 /home 으로 간다 — 리포트·궁합·상담이 같은 출구를 쓴다", () => {
  const html = renderToStaticMarkup(<HomeLink />);
  expect(html).toContain('href="/home"');
  expect(html).toContain("홈");
});

// 화살표는 방향을 그리는 장식이다. 스크린리더가 "왼쪽 화살표 홈" 으로 읽으면
// 링크 이름이 흐려진다.
test("화살표는 스크린리더에서 뺀다", () => {
  const html = renderToStaticMarkup(<HomeLink />);
  expect(html).toContain('aria-hidden="true"');
});
