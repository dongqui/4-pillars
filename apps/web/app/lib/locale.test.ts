import { describe, it, expect } from "vitest";
import { resolveLocale, localeFromRequest, DEFAULT_LOCALE } from "./locale";

describe("resolveLocale", () => {
  it("kr. 로 시작하는 host는 ko", () => {
    expect(resolveLocale({ host: "kr.example.com" })).toBe("ko");
  });
  it("jp. 로 시작하는 host는 ja", () => {
    expect(resolveLocale({ host: "jp.example.com" })).toBe("ja");
  });
  it("매칭 안 되는 host는 기본값 ko", () => {
    expect(resolveLocale({ host: "preview.vercel.app" })).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ host: null })).toBe(DEFAULT_LOCALE);
  });
  it("langParam이 host보다 우선한다", () => {
    expect(resolveLocale({ host: "kr.example.com", langParam: "ja" })).toBe("ja");
  });
  it("envLocale이 host보다 우선하고 langParam보다 후순위다", () => {
    expect(resolveLocale({ host: "kr.example.com", envLocale: "ja" })).toBe("ja");
    expect(resolveLocale({ host: "kr.example.com", envLocale: "ja", langParam: "ko" })).toBe("ko");
  });
  it("잘못된 값은 무시하고 다음 우선순위로 넘어간다", () => {
    expect(resolveLocale({ host: "jp.example.com", langParam: "xx" })).toBe("ja");
  });
});

describe("localeFromRequest", () => {
  it("Request의 host 헤더와 ?lang 쿼리로 판별한다", () => {
    const req = new Request("https://kr.example.com/login?lang=ja", {
      headers: { host: "kr.example.com" },
    });
    expect(localeFromRequest(req)).toBe("ja");
  });
});
