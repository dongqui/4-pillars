import { describe, it, expect } from "vitest";
import { getLocale, localeToCountry } from "./locale";

describe("locale", () => {
  it("localeToCountry는 ko→KR, ja→JP", () => {
    expect(localeToCountry("ko")).toBe("KR");
    expect(localeToCountry("ja")).toBe("JP");
  });

  it("getLocale는 현재 ko 고정", () => {
    expect(getLocale()).toBe("ko");
  });
});
