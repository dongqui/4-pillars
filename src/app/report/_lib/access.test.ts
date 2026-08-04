import { describe, it, expect } from "vitest";
import { getReportAccess, parseProfileParam } from "./access";
import type { SessionPayload } from "@/lib/auth/session";

const session: SessionPayload = { userId: "1", provider: "google" };

describe("getReportAccess", () => {
  it("세션 없고 미결제면 비로그인·미결제", () => {
    expect(getReportAccess({}, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("세션 있으면 로그인·미결제", () => {
    expect(getReportAccess({}, session)).toEqual({ isLoggedIn: true, isPaid: false });
  });
  it("?paid=true 는 로그인+결제 (세션 없어도 개발 토글)", () => {
    expect(getReportAccess({ paid: "true" }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(getReportAccess({ paid: ["true", "false"] }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("paid가 true가 아니면 결제 무시", () => {
    expect(getReportAccess({ paid: "1" }, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
});

describe("parseProfileParam", () => {
  it("파라미터가 없으면 absent — 픽스처 데모로 간다", () => {
    expect(parseProfileParam({})).toEqual({ kind: "absent" });
  });

  it("순번 id 는 문자열 그대로 통과", () => {
    expect(parseProfileParam({ profile: "12" })).toEqual({ kind: "id", id: "12" });
  });

  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(parseProfileParam({ profile: ["7", "8"] })).toEqual({ kind: "id", id: "7" });
  });

  // ::bigint 캐스팅 전에 막지 않으면 잘못된 값 하나가 DB 에러 → 500 이 된다.
  it.each(["abc", "1 OR 1=1", "", "-1", "1.5", "1e3", " 12"])(
    "%o 는 invalid — DB 를 건드리지 않는다",
    (raw) => {
      expect(parseProfileParam({ profile: raw })).toEqual({ kind: "invalid" });
    },
  );
});
