import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("WEB_ORIGINS를 콤마로 분리한다", () => {
    const cfg = loadConfig({
      SESSION_COOKIE_DOMAIN: ".example.com",
      WEB_ORIGINS: "https://kr.example.com,https://jp.example.com",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(cfg.webOrigins).toEqual(["https://kr.example.com", "https://jp.example.com"]);
    expect(cfg.secureCookies).toBe(true);
    expect(cfg.sessionCookieDomain).toBe(".example.com");
  });

  it("개발 환경에서는 secureCookies가 false다", () => {
    const cfg = loadConfig({ WEB_ORIGINS: "http://localhost:3000", NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(cfg.secureCookies).toBe(false);
  });
});
