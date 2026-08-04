import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/auth/providers";
import { completeOAuth } from "@/lib/auth/callback";
import { upsertUser } from "@/lib/auth/users";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import { DRAFT_COOKIE, deleteDraft, getDraft } from "@/lib/drafts/store";
import { promoteDraft } from "@/lib/drafts/promote";

const LAST_PROVIDER_MAX_AGE = 60 * 60 * 24 * 180; // 180일

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return new NextResponse("unknown provider", { status: 404 });

  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv] ?? "";
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, "");
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
      origin,
    });
    const promoted = await promoteDraft(
      req.cookies.get(DRAFT_COOKIE)?.value ?? null,
      result.userId,
      { getDraft, createProfile, deleteDraft },
    );

    // 프로필 id 는 지금 막 생겼으므로 next 에 미리 담을 수 없었다 — 행선지는 여기서 정한다.
    // 결제가 붙으면 promoted 갈래가 체크아웃으로 바뀌고, 그 뒤에 리포트로 이어진다.
    const redirectTo =
      promoted.kind === "promoted"
        ? `/report?profile=${promoted.id}`
        : promoted.kind === "limit"
          ? "/home?error=limit"
          : result.redirectTo;

    const res = NextResponse.redirect(new URL(redirectTo, origin));
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
    // limit·failed 는 드래프트를 남긴다 — 손잡이를 지우면 다시 시도할 방법이 없다.
    if (promoted.kind === "promoted" || promoted.kind === "none") {
      res.cookies.delete(DRAFT_COOKIE);
    }
    return res;
  } catch (e) {
    console.error("[oauth callback]", e instanceof Error ? e.message : e);
    const res = NextResponse.redirect(new URL("/login?error=oauth", origin));
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_verifier");
    res.cookies.delete("oauth_next");
    return res;
  }
}
