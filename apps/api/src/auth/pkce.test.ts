import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPkcePair, generateNonce, generateState, randomToken } from "./pkce.js";

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("pkce", () => {
  it("randomToken은 매번 다른 base64url 문자열을 만든다", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("createPkcePair의 challenge는 verifier의 sha256 base64url이다", () => {
    const { verifier, challenge } = createPkcePair();
    const expected = b64url(createHash("sha256").update(verifier).digest());
    expect(challenge).toEqual(expected);
  });

  it("state와 nonce는 비어있지 않다", () => {
    expect(generateState().length).toBeGreaterThan(10);
    expect(generateNonce().length).toBeGreaterThan(10);
  });
});
