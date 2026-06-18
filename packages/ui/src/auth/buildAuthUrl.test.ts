import { describe, expect, it } from "vitest";
import { buildAuthUrl, PROVIDER_ORDER } from "./buildAuthUrl.js";

describe("buildAuthUrl", () => {
  it("api start 엔드포인트로 returnUrl을 인코딩해 붙인다", () => {
    const url = buildAuthUrl({
      apiBaseUrl: "https://api.example.com",
      provider: "google",
      returnUrl: "https://kr.example.com/welcome?x=1",
    });
    expect(url).toBe(
      "https://api.example.com/auth/google/start?redirect=https%3A%2F%2Fkr.example.com%2Fwelcome%3Fx%3D1",
    );
  });

  it("apiBaseUrl 끝의 슬래시를 정규화한다", () => {
    const url = buildAuthUrl({ apiBaseUrl: "https://api.example.com/", provider: "line", returnUrl: "https://x.com" });
    expect(url.startsWith("https://api.example.com/auth/line/start")).toBe(true);
  });

  it("4개 provider를 정해진 순서로 노출한다", () => {
    expect(PROVIDER_ORDER).toEqual(["kakao", "line", "google", "apple"]);
  });

  it("locale가 주어지면 쿼리에 붙인다", () => {
    const url = buildAuthUrl({ apiBaseUrl: "https://api.example.com", provider: "kakao", returnUrl: "https://x.com", locale: "ko" });
    expect(url).toContain("&locale=ko");
  });
});
