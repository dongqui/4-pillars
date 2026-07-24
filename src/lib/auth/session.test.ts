import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { encodeSession, decodeSession } from "./session";

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-test-secret-test-secret-01";
});

const secret = () => new TextEncoder().encode(process.env.AUTH_SESSION_SECRET);

describe("session encode/decode", () => {
  it("라운드트립", async () => {
    const token = await encodeSession({ userId: "42", provider: "google" });
    expect(await decodeSession(token)).toEqual({ userId: "42", provider: "google" });
  });
  it("undefined 토큰은 null", async () => {
    expect(await decodeSession(undefined)).toBeNull();
  });
  it("변조 토큰은 null", async () => {
    const token = await encodeSession({ userId: "42", provider: "google" });
    expect(await decodeSession(token + "x")).toBeNull();
  });
  it("만료 토큰은 null", async () => {
    const expired = await new SignJWT({ userId: "1", provider: "google" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret());
    expect(await decodeSession(expired)).toBeNull();
  });
  it("필수 클레임 없으면 null", async () => {
    const bad = await new SignJWT({ foo: "bar" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret());
    expect(await decodeSession(bad)).toBeNull();
  });
});
