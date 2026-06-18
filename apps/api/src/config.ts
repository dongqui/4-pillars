export interface AppConfig {
  sessionCookieName: string;
  sessionCookieDomain: string;
  secureCookies: boolean;
  webOrigins: string[];
  defaultRedirect: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const webOrigins = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sessionCookieName: env.SESSION_COOKIE_NAME ?? "sid",
    sessionCookieDomain: env.SESSION_COOKIE_DOMAIN ?? "",
    secureCookies: env.NODE_ENV === "production",
    webOrigins,
    defaultRedirect: env.DEFAULT_REDIRECT ?? webOrigins[0] ?? "http://localhost:3000",
  };
}
