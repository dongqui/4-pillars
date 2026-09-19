import { NextResponse, type NextRequest } from "next/server";
import {
  REVIEW_DISPLAY_NAME,
  REVIEW_PROVIDER,
  reviewLoginConfig,
  seedSampleProfile,
  verifyReviewLogin,
} from "@/lib/auth/review-login";
import { safeNext } from "@/lib/auth/oauth";
import { setPrimaryProfileIfUnset, upsertUser } from "@/lib/auth/users";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { countProfiles, createProfile } from "@/lib/profiles/store";
import { DRAFT_COOKIE, deleteDraft, getDraft } from "@/lib/drafts/store";
import { promoteDraft } from "@/lib/drafts/promote";
import { redis } from "@/lib/redis";

const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_SECONDS = 60 * 10;

/** 리미터가 죽었다고 심사가 막히면 안 된다 — Redis 가 실패하면 기록만 남기고 통과시킨다. */
async function tooManyAttempts(req: NextRequest): Promise<boolean> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `review-login:attempts:${ip}`;
  try {
    const attempts = await redis.incr(key);
    // 첫 시도에만 만료를 건다 — 매번 걸면 계속 두드리는 쪽의 창이 영영 안 닫힌다.
    if (attempts === 1) await redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    return attempts > ATTEMPT_LIMIT;
  } catch (e) {
    console.error("[review-login] attempt counter", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * 카드사 심사용 임시 로그인 (lib/auth/review-login.ts 참조).
 *
 * 성공 뒤의 흐름(드래프트 승격 → 행선지 → 쿠키)은 callbacks/[provider]/route.ts 와 같다.
 * 공통 함수로 뽑지 않고 겹쳐 둔 것은 의도다 — 이 파일은 심사가 끝나면 통째로 지운다.
 */
export async function POST(req: NextRequest) {
  const config = reviewLoginConfig();
  if (!config) return new NextResponse("not found", { status: 404 });

  const origin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!origin) return new NextResponse("auth not configured", { status: 500 });

  // 공용 계정이라 로그인 CSRF 가 실제 피해로 이어진다 — 남이 심어 준 세션에서 넣은
  // 생년월일을 비밀번호를 아는 누구나 본다. 브라우저는 POST 에 Origin 을 붙인다.
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    // 403 으로 끊지 않는다 — www/apex 처럼 우리 호스트인데 정식 주소가 아닐 뿐일 수 있다.
    // 로그인시키지 않고 정식 주소의 폼으로 돌려보낸다. 남의 사이트에서 온 것이어도 잃는 게 없다.
    return NextResponse.redirect(new URL("/login", origin), 303);
  }

  // 비밀번호가 짧고 담당자들 사이에 돈다 — 온라인 대입을 IP 당 10분에 10번으로 묶는다.
  // 성공·실패를 가리지 않고 센다: incr 하나로 끝나 읽고-쓰기 경합이 없고, 담당자는 이 숫자에 닿지 않는다.
  if (await tooManyAttempts(req)) {
    return NextResponse.redirect(new URL("/login?error=throttled", origin), 303);
  }

  const form = await req.formData();
  const id = form.get("id");
  const password = form.get("password");
  const nextField = form.get("next");
  const next = typeof nextField === "string" && nextField ? nextField : null;

  if (
    typeof id !== "string" ||
    typeof password !== "string" ||
    !verifyReviewLogin(config, id, password)
  ) {
    const keepNext = next ? `&next=${encodeURIComponent(next)}` : "";
    // POST 의 응답이므로 303 — 307 이면 브라우저가 /login 에 POST 를 다시 보낸다.
    return NextResponse.redirect(new URL(`/login?error=review${keepNext}`, origin), 303);
  }

  const user = await upsertUser({
    provider: REVIEW_PROVIDER,
    providerUserId: config.id,
    email: config.email,
    displayName: REVIEW_DISPLAY_NAME,
  });

  const promoted = await promoteDraft(req.cookies.get(DRAFT_COOKIE)?.value ?? null, user.id, {
    getDraft,
    createProfile,
    deleteDraft,
    setPrimaryIfUnset: setPrimaryProfileIfUnset,
  });

  // 담당자가 직접 넣은 생년월일이 방금 프로필이 됐으면 그것으로 충분하다. 아니면 빈 홈 대신
  // 샘플 하나를 세워 둔다 — 프로필이 이미 있는지는 seedSampleProfile 이 센다.
  if (promoted.kind !== "promoted") {
    await seedSampleProfile(user.id, {
      countProfiles,
      createProfile,
      setPrimaryIfUnset: setPrimaryProfileIfUnset,
    });
  }

  const redirectTo =
    promoted.kind === "promoted"
      ? `/report?profile=${promoted.id}`
      : promoted.kind === "limit"
        ? "/home?error=limit"
        : safeNext(next, origin);

  const res = NextResponse.redirect(new URL(redirectTo, origin), 303);
  res.cookies.set(
    SESSION_COOKIE,
    await encodeSession({ userId: user.id, provider: REVIEW_PROVIDER }),
    sessionCookieOptions(),
  );
  // limit·failed 는 드래프트를 남긴다 — 손잡이를 지우면 다시 시도할 방법이 없다.
  if (promoted.kind === "promoted" || promoted.kind === "none") {
    res.cookies.delete(DRAFT_COOKIE);
  }
  return res;
}
