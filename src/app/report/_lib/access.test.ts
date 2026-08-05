import { describe, it, expect, afterEach, vi } from "vitest";
import { getReportAccess } from "./access";
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
