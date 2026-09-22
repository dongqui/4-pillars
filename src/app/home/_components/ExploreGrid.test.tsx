import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExploreGrid } from "./ExploreGrid";
import { featurePriceLabel } from "../../_lib/catalog";

function card(html: string, title: string): string {
  // 카드 하나만 잘라낸다 — 제목 앞의 배지 줄부터 다음 카드 직전까지.
  const start = html.lastIndexOf("<a ", html.indexOf(`>${title}<`));
  const end = html.indexOf("</a>", start);
  return html.slice(start, end);
}

test("리포트·관계 지도만 빼고 전부 이용권 한 장 값이 붙는다", () => {
  const html = renderToStaticMarkup(
    <ExploreGrid reportHref="/report" consultHref="/consult" />,
  );
  const paid = featurePriceLabel("consultation");
  expect(paid).toBe("1,000원");

  expect(card(html, "한 해의 흐름")).toContain(`>${paid}<`);
  expect(card(html, "고민상담")).toContain(`>${paid}<`);
  expect(card(html, "궁합")).toContain(`>${paid}<`);
});

test("리포트는 일부 무료, 관계 지도는 무료로 적는다", () => {
  const html = renderToStaticMarkup(
    <ExploreGrid reportHref="/report" consultHref="/consult" />,
  );
  expect(card(html, "리포트")).toContain(
    `>${featurePriceLabel("full_report")} · 일부 무료<`,
  );
  expect(card(html, "관계 지도")).toContain(">무료<");
  expect(card(html, "관계 지도")).not.toContain("원");
});
