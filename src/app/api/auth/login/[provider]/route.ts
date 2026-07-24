import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/auth/providers";
import { generateState, generateCodeVerifier, codeChallengeS256, buildAuthorizeUrl } from "@/lib/auth/oauth";

const TX_MAX_AGE = 600; // 10분

function txCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TX_MAX_AGE,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return new NextResponse("unknown provider", { status: 404 });

  const clientId = process.env[provider.clientIdEnv];
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!clientId || !origin) return new NextResponse("auth not configured", { status: 500 });

  const redirectUri = `${origin}/api/auth/callbacks/${provider.id}`;
  const state = generateState();
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(verifier);
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  const authorizeUrl = buildAuthorizeUrl(provider, { clientId, redirectUri, state, codeChallenge: challenge });
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("oauth_state", state, txCookieOptions());
  res.cookies.set("oauth_verifier", verifier, txCookieOptions());
  res.cookies.set("oauth_next", next, txCookieOptions());
  return res;
}
