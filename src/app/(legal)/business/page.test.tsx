import { renderToStaticMarkup } from "react-dom/server";
import BusinessInfoPage from "./page";

test("법정 표시 항목이 화면에 있다", () => {
  const html = renderToStaticMarkup(<BusinessInfoPage />);
  expect(html).toContain("헤일메리랩스");
  expect(html).toContain("432-33-01882");
  expect(html).toContain("김동진");
  expect(html).toContain("hailmarylabs@gmail.com");
  expect(html).toContain("통신판매업 신고 준비중");
});
