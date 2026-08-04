import { describe, it, expect, afterEach, vi } from "vitest";
import { getReportAccess, parseProfileParam } from "./access";
import type { SessionPayload } from "@/lib/auth/session";

const session: SessionPayload = { userId: "1", provider: "google" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getReportAccess", () => {
  it("세션 없고 미결제면 비로그인·미결제", () => {
    expect(getReportAccess({}, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("세션 있으면 로그인·미결제", () => {
    expect(getReportAccess({}, session)).toEqual({ isLoggedIn: true, isPaid: false });
  });
  it("?paid=true 는 로그인+결제 (세션 없어도 개발 토글, 프로덕션이 아니면)", () => {
    expect(getReportAccess({ paid: "true" }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(getReportAccess({ paid: ["true", "false"] }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("paid가 true가 아니면 결제 무시", () => {
    expect(getReportAccess({ paid: "1" }, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("프로덕션에서는 ?paid=true 토글을 무시한다 — 실제 유료 생성을 공짜로 트리거 못 하게", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getReportAccess({ paid: "true" }, null)).toEqual({ isLoggedIn: false, isPaid: false });
    expect(getReportAccess({ paid: "true" }, session)).toEqual({ isLoggedIn: true, isPaid: false });
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
  it.each(["abc", "1 OR 1=1", "", "-1", "1.5", "1e3", " 12", "9".repeat(20), "007"])(
    "%o 는 invalid — DB 를 건드리지 않는다",
    (raw) => {
      expect(parseProfileParam({ profile: raw })).toEqual({ kind: "invalid" });
    },
  );

  it("bigint 상한(9223372036854775807)은 통과한다", () => {
    expect(parseProfileParam({ profile: "9223372036854775807" })).toEqual({
      kind: "id",
      id: "9223372036854775807",
    });
  });

  it("bigint 상한을 하나 넘으면(9223372036854775808) invalid — ::bigint 캐스팅이 넘치지 않게", () => {
    expect(parseProfileParam({ profile: "9223372036854775808" })).toEqual({ kind: "invalid" });
  });
});
