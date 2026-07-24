import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/auth/providers";
import { completeOAuth } from "@/lib/auth/callback";
import { upsertUser } from "@/lib/auth/users";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const LAST_PROVIDER_MAX_AGE = 60 * 60 * 24 * 180; // 180일

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return new NextResponse("unknown provider", { status: 404 });

  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv] ?? "";
  const origin = process.env.APP_ORIGIN;
  if (!clientId || !origin) return new NextResponse("auth not configured", { status: 500 });

  const redirectUri = `${origin}/api/auth/callbacks/${provider.id}`;
  const params = {
    code: req.nextUrl.searchParams.get("code"),
    state: req.nextUrl.searchParams.get("state"),
    storedState: req.cookies.get("oauth_state")?.value ?? null,
    codeVerifier: req.cookies.get("oauth_verifier")?.value ?? null,
    next: req.cookies.get("oauth_next")?.value ?? null,
  };

  try {
    const result = await completeOAuth(provider, params, {
      fetchImpl: fetch,
      upsert: upsertUser,
      clientId,
      clientSecret,
      redirectUri,
    });
    const res = NextResponse.redirect(new URL(result.redirectTo, origin));
    res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
    res.cookies.set("last_provider", result.provider, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: LAST_PROVIDER_MAX_AGE,
    });
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_verifier");
    res.cookies.delete("oauth_next");
    return res;
  } catch (e) {
    console.error("[oauth callback]", e);
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }
}
