/**
 * 사업자 정보 단일 출처. 랜딩 푸터·/business·약관이 모두 여기서만 읽는다.
 * 값은 사업자등록증명원(프로젝트엔, 2026-08-18 발급) 기준 — 등록번호·대표자·소재지는
 * 그대로고 상호만 헤일메리랩스에서 바뀌었다.
 */
export const COMPANY = {
  name: "프로젝트엔",
  ceo: "김동진",
  registrationNumber: "432-33-01882",
  address: "경기도 이천시 경충대로2762번길 29-107, 102-S21호 (관고동)",
  mailOrderSalesNumber: "제2026-경기이천-0577호",
  contactEmail: "hailmarylabs@gmail.com",
  openedOn: "2026-08-05",
} as const;
