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
    "한 해의 흐름",
  ]);
});

test("모든 항목이 갈 곳을 갖는다 — 랜딩에서 눌리면 열려야 한다", () => {
  expect(MENU_ITEMS.every((m) => m.href.startsWith("/"))).toBe(true);
  // 관계 지도는 랜딩에서 걷었다 — 카탈로그에 되돌아오면 알 수 있게 적어 둔다.
  expect(MENU_ITEMS.find((m) => m.title === "관계 지도")).toBeUndefined();
});

test("천 단위 구분자 — 서버·브라우저가 같은 문자열을 낸다", () => {
  expect(formatWon(1000)).toBe("1,000원");
  expect(formatWon(10000)).toBe("10,000원");
});

// 리포트에서 세운·대운을 걷어냈다. 상품 설명이 없는 것을 팔면 안 된다.
test("리포트 설명이 운세를 약속하지 않는다", () => {
  const report = MENU_ITEMS.find((m) => m.href === "/report");
  expect(report).toBeDefined();
  expect(report!.desc).not.toMatch(/올해|운세|대운|흐름/);
});
