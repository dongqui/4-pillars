import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "./page";

test("수집 항목·위탁·문의처를 고지한다", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  expect(html).toContain("수집");
  expect(html).toContain("위탁");
  expect(html).toContain("생년월일시");
  expect(html).toContain("hailmarylabs@gmail.com");
});
