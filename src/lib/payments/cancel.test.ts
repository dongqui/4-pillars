import { describe, expect, test } from "vitest";
import { isUserCancel } from "./cancel";

describe("isUserCancel", () => {
  test("KCP 사용자 취소(3001)는 취소다", () => {
    expect(isUserCancel({ code: "FAILURE_TYPE_PG", pgCode: "3001" })).toBe(true);
  });
  test("pgCode 가 빠져도 메시지 앞머리 [3001] 로 알아본다", () => {
    expect(
      isUserCancel({ code: "FAILURE_TYPE_PG", message: "[3001] 사용자가 결제를 취소하였습니다." }),
    ).toBe(true);
  });
  test("다른 PG 오류는 취소가 아니다", () => {
    expect(isUserCancel({ code: "FAILURE_TYPE_PG", pgCode: "8105", message: "[8105] 카드 한도 초과" })).toBe(false);
  });
  test("성공(코드 없음)은 취소가 아니다", () => {
    expect(isUserCancel({})).toBe(false);
  });
  test("모바일 복귀 쿼리 모양(null) 도 받는다", () => {
    expect(isUserCancel({ code: "FAILURE_TYPE_PG", pgCode: null, message: null })).toBe(false);
  });
});
