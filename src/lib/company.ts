/**
 * 사업자 정보 단일 출처. 랜딩 푸터·/business·약관이 모두 여기서만 읽는다.
 * 값은 사업자등록증명원(헤일메리랩스, 2026-08-12 발급) 기준.
 */
export const COMPANY = {
  name: "헤일메리랩스",
  ceo: "김동진",
  registrationNumber: "432-33-01882",
  address: "경기도 이천시 경충대로2762번길 29-107, 102-S21호 (관고동)",
  // TODO(통신판매업): 신고 완료 후 실제 번호로 교체. 예: "제2026-경기이천-0000호"
  mailOrderSalesNumber: "통신판매업 신고 준비중",
  contactEmail: "hailmarylabs@gmail.com",
  openedOn: "2026-08-05",
} as const;
