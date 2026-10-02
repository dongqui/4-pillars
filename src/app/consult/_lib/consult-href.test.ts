import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/nav/next-param";
import { consultCheckoutHref, consultListHref } from "./consult-href";

describe("consultListHref", () => {
  // 상담 목록이 프로필로 걸러지면서, 프로필 없이 /consult 로 돌아가면 계정의 "나" 목록이
  // 열린다. 백상현으로 상담을 열고 "‹ 목록으로" 를 누르면 방금 나온 상담이 없는 김동진
  // 목록에 떨어진다 — 그래서 돌아갈 때 그 상담의 프로필을 싣는다.
  it("프로필이 있으면 그 프로필의 목록으로", () => {
    expect(consultListHref("7")).toBe("/consult?profile=7");
  });

  // profile_id 가 NULL 인 옛 상담(소프트 삭제 이전에 진짜 지워진 프로필)은 돌아갈
  // 사람이 없다 — 계정의 "나" 로 간다.
  it("프로필이 없으면 그냥 /consult", () => {
    expect(consultListHref(null)).toBe("/consult");
  });
});

describe("consultCheckoutHref", () => {
  // 이용권을 사러 갔다 오면 고르던 사람의 목록으로 돌아와야 한다.
  it("결제 뒤 그 프로필의 목록으로 돌아온다", () => {
    const href = consultCheckoutHref("7");
    const next = new URL(href, "http://x").searchParams.get("next");
    expect(next).toBe("/consult?profile=7");
    // /checkout 이 next 를 safeNextPath 로 거른다 — 거기서 홈으로 접히면 안 된다.
    expect(safeNextPath(next)).toBe("/consult?profile=7");
  });

  // next 안의 ? 와 = 가 인코딩되지 않으면 /checkout 의 쿼리로 새어 profile 이 checkout
  // 의 파라미터가 되어 버린다.
  it("next 를 인코딩한다", () => {
    expect(consultCheckoutHref("7")).toBe("/checkout?next=%2Fconsult%3Fprofile%3D7");
  });

  it("프로필이 없으면 /consult 로 돌아온다", () => {
    expect(consultCheckoutHref(null)).toBe("/checkout?next=%2Fconsult");
  });
});
