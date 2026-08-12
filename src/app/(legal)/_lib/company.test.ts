import { COMPANY } from "./company";

test("사업자 핵심 값이 등록증과 일치한다", () => {
  expect(COMPANY.name).toBe("헤일메리랩스");
  expect(COMPANY.ceo).toBe("김동진");
  expect(COMPANY.registrationNumber).toBe("432-33-01882");
  expect(COMPANY.contactEmail).toBe("hailmarylabs@gmail.com");
});

test("통신판매업 신고번호는 아직 placeholder 다", () => {
  expect(COMPANY.mailOrderSalesNumber).toBe("통신판매업 신고 준비중");
});
