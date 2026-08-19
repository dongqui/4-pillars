import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BusinessInfoPage from "./page";

test("법정 표시 항목이 화면에 있다", () => {
  const html = renderToStaticMarkup(<BusinessInfoPage />);
  expect(html).toContain("프로젝트엔");
  expect(html).toContain("432-33-01882");
  expect(html).toContain("김동진");
  expect(html).toContain("hailmarylabs@gmail.com");
  expect(html).toContain("제2026-경기이천-0577호");
});
