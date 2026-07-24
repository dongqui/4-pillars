import { describe, it, expect } from "vitest";
import { getReportAccess } from "./access";

describe("getReportAccess", () => {
  it("기본은 비로그인·미결제", () => {
    expect(getReportAccess({})).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("?paid=true 는 로그인+결제", () => {
    expect(getReportAccess({ paid: "true" })).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("?login=true 는 로그인·미결제", () => {
    expect(getReportAccess({ login: "true" })).toEqual({ isLoggedIn: true, isPaid: false });
  });
  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(getReportAccess({ paid: ["true", "false"] })).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("true 가 아니면 무시", () => {
    expect(getReportAccess({ paid: "1", login: "yes" })).toEqual({ isLoggedIn: false, isPaid: false });
  });
});
