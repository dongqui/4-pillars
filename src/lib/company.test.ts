import { test, expect } from "vitest";
import { COMPANY } from "./company";

test("사업자 핵심 값이 등록증과 일치한다", () => {
  expect(COMPANY.name).toBe("프로젝트엔");
  expect(COMPANY.ceo).toBe("김동진");
  expect(COMPANY.registrationNumber).toBe("432-33-01882");
  expect(COMPANY.contactEmail).toBe("hailmarylabs@gmail.com");
});

test("통신판매업 신고번호가 박혀 있다 — 초기 화면 표시 의무 항목이다", () => {
  expect(COMPANY.mailOrderSalesNumber).toBe("제2026-경기이천-0577호");
});
