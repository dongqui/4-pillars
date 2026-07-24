import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface SessionPayload {
  userId: string;
  provider: string;
}

const ALG = "HS256";
export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

function key(): Uint8Array {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s) throw new Error("AUTH_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, provider: payload.provider })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function decodeSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] });
    if (typeof payload.userId !== "string" || typeof payload.provider !== "string") return null;
    return { userId: payload.userId, provider: payload.provider };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
