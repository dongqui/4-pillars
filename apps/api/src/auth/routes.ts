import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ProviderName } from "../db/schema.js";
import type { AppConfig } from "../config.js";
import { resolveUser, type AuthRepo } from "./account.js";
import { createPkcePair, generateNonce, generateState } from "./pkce.js";
import { endSession, getSessionUser, issueSession, type SessionRepo } from "./session.js";
import type { OAuthProvider } from "./types.js";

export interface AuthDeps {
  providers: Record<ProviderName, OAuthProvider>;
  authRepo: AuthRepo;
  sessionRepo: SessionRepo;
  config: AppConfig;
  now?: () => Date;
}

const TX_COOKIE = "oauth_tx";

interface TxState {
  state: string;
  verifier: string;
  nonce: string;
  redirect: string;
}

function isAllowedRedirect(redirect: string, webOrigins: string[]): boolean {
  try {
    return webOrigins.includes(new URL(redirect).origin);
  } catch {
    return false;
  }
}

function isProviderName(deps: AuthDeps, name: string): name is ProviderName {
  return Object.prototype.hasOwnProperty.call(deps.providers, name);
}

async function safeFormValue(
  c: { req: { parseBody: () => Promise<Record<string, unknown>> } },
  key: string,
): Promise<string | undefined> {
  try {
    const body = await c.req.parseBody();
    const v = body[key];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function createAuthRoutes(deps: AuthDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? (() => new Date());
  const { config } = deps;

  const cookieBase = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "Lax" as const,
    ...(config.sessionCookieDomain ? { domain: config.sessionCookieDomain } : {}),
  };

  app.get("/:provider/start", (c) => {
    const provider = c.req.param("provider");
    if (!isProviderName(deps, provider)) return c.json({ error: "unknown provider" }, 404);

    const redirect = c.req.query("redirect") ?? config.defaultRedirect;
    if (!isAllowedRedirect(redirect, config.webOrigins)) {
      return c.json({ error: "invalid redirect" }, 400);
    }

    const state = generateState();
    const nonce = generateNonce();
    const { verifier, challenge } = createPkcePair();
    const tx: TxState = { state, verifier, nonce, redirect };

    setCookie(c, TX_COOKIE, JSON.stringify(tx), {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "Lax",
      path: "/auth",
      maxAge: 600,
    });

    const url = deps.providers[provider].buildAuthorizeUrl({ state, codeChallenge: challenge, nonce });
    return c.redirect(url, 302);
  });

  const handleCallback = async (c: Context) => {
    const provider = c.req.param("provider") ?? "";
    if (!isProviderName(deps, provider)) return c.json({ error: "unknown provider" }, 404);

    const raw = getCookie(c, TX_COOKIE);
    if (!raw) return c.json({ error: "missing tx" }, 400);
    let tx: TxState;
    try {
      tx = JSON.parse(decodeURIComponent(raw)) as TxState;
    } catch {
      return c.json({ error: "bad tx" }, 400);
    }

    const incomingState = c.req.query("state") ?? (await safeFormValue(c, "state"));
    const code = c.req.query("code") ?? (await safeFormValue(c, "code"));
    if (!incomingState || incomingState !== tx.state) return c.json({ error: "state mismatch" }, 400);
    if (!code) return c.json({ error: "missing code" }, 400);

    const p = deps.providers[provider];
    const tokens = await p.exchangeCode({ code, codeVerifier: tx.verifier });
    const profile = await p.fetchProfile(tokens);

    const { userId } = await resolveUser(deps.authRepo, { provider, profile, locale: null });
    const { token, expiresAt } = await issueSession(deps.sessionRepo, userId, now());

    deleteCookie(c, TX_COOKIE, { path: "/auth" });
    setCookie(c, config.sessionCookieName, token, {
      ...cookieBase,
      path: "/",
      expires: expiresAt,
    });

    return c.redirect(tx.redirect, 302);
  };

  app.get("/:provider/callback", handleCallback);
  app.post("/:provider/callback", handleCallback);

  app.get("/me", async (c) => {
    const token = getCookie(c, config.sessionCookieName);
    if (!token) return c.json({ error: "unauthenticated" }, 401);
    const session = await getSessionUser(deps.sessionRepo, token, now());
    if (!session) return c.json({ error: "unauthenticated" }, 401);
    const user = await deps.authRepo.getUserById(session.userId);
    if (!user) return c.json({ error: "unauthenticated" }, 401);
    return c.json({ user });
  });

  app.post("/logout", async (c) => {
    const token = getCookie(c, config.sessionCookieName);
    if (token) await endSession(deps.sessionRepo, token, now());
    deleteCookie(c, config.sessionCookieName, {
      path: "/",
      ...(config.sessionCookieDomain ? { domain: config.sessionCookieDomain } : {}),
    });
    return c.json({ ok: true });
  });

  return app;
}
