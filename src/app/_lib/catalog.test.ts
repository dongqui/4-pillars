import { test, expect } from "vitest";
import { getPackage } from "@/lib/payments/pricing";
import { FEATURE_IDS } from "@/lib/tickets/features";
import { MENU_ITEMS, TICKET_PRICE_LABEL, formatWon } from "./catalog";

test("가격은 t1 패키지에서 파생된다 — 랜딩에 숫자를 따로 적지 않는다", () => {
  expect(TICKET_PRICE_LABEL).toBe(formatWon(getPackage("t1").amount));
  const report = MENU_ITEMS.find((m) => m.title === "성향 리포트");
  expect(report?.price).toBe(formatWon(getPackage("t1").amount));
});

test("유료 항목은 실제 판매 기능과 개수·순서가 같다", () => {
  expect(MENU_ITEMS.filter((m) => m.paid)).toHaveLength(FEATURE_IDS.length);
  expect(MENU_ITEMS.filter((m) => m.paid).map((m) => m.title)).toEqual([
    "성향 리포트",
    "두 사람 궁합",
    "고민상담",
  ]);
});

test("화면이 없는 항목은 링크를 갖지 않는다", () => {
  expect(MENU_ITEMS.find((m) => m.title === "관계 지도")?.href).toBeNull();
  // 나머지는 전부 갈 곳이 있다
  expect(MENU_ITEMS.filter((m) => m.href === null)).toHaveLength(1);
});

test("천 단위 구분자 — 서버·브라우저가 같은 문자열을 낸다", () => {
  expect(formatWon(1000)).toBe("1,000원");
  expect(formatWon(10000)).toBe("10,000원");
});
