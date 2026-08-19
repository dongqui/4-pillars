import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Hero } from "./Hero";

test("비로그인은 퍼널로 보내고, 인사 문구를 띄우지 않는다", () => {
  const html = renderToStaticMarkup(<Hero displayName={null} />);
  expect(html).toContain('href="/funnel?step=name"');
  expect(html).toContain("내 리포트 만들기");
  expect(html).not.toContain("다시 오셨네요");
});

test("로그인은 홈으로 보내고 이름으로 맞이한다", () => {
  const html = renderToStaticMarkup(<Hero displayName="지우" />);
  expect(html).toContain('href="/home"');
  expect(html).toContain("내 리포트 보기");
  expect(html).toContain("지우님, 다시 오셨네요");
  // 다른 사람 사주도 같은 퍼널로 들어간다
  expect(html).toContain('href="/funnel?step=name"');
});

test("가격을 문자열로 박지 않는다 — 이용권 한 장 값에서 나온다", () => {
  const html = renderToStaticMarkup(<Hero displayName={null} />);
  expect(html).toContain("개당 1,000원");
});
