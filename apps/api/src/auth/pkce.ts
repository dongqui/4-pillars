import { createHash, randomBytes } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 인코딩된 암호학적 랜덤 토큰. */
export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

export function generateState(): string {
  return randomToken(32);
}

export function generateNonce(): string {
  return randomToken(16);
}

/** PKCE verifier/challenge 쌍 (S256). */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
