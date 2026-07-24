import { describe, it, expect } from "vitest";
import { getProvider, PROVIDERS, type FetchLike } from "./providers";

function fakeFetch(json: unknown, ok = true): FetchLike {
  return (async () => ({ ok, status: ok ? 200 : 500, json: async () => json })) as unknown as FetchLike;
}

// LINE id_token: 서명 검증 없이 payload만 디코딩하므로 JWT 형태이면 충분
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.`;
}

describe("getProvider", () => {
  it("알 수 없는 provider는 null", () => {
    expect(getProvider("apple")).toBeNull();
    expect(getProvider("")).toBeNull();
  });
  it("google/line/kakao는 설정 반환", () => {
    expect(getProvider("google")?.id).toBe("google");
    expect(getProvider("line")?.id).toBe("line");
    expect(getProvider("kakao")?.id).toBe("kakao");
  });
});

describe("fetchProfile", () => {
  it("google: userinfo 응답을 정규화", async () => {
    const fetchImpl = fakeFetch({ sub: "g-1", email: "a@g.com", name: "지민", picture: "http://img/a" });
    const p = await PROVIDERS.google.fetchProfile({ access_token: "t" }, fetchImpl);
    expect(p).toEqual({ providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: "http://img/a" });
  });
  it("kakao: kakao_account 중첩을 정규화", async () => {
    const fetchImpl = fakeFetch({ id: 12345, kakao_account: { email: "k@k.com", profile: { nickname: "카톡", profile_image_url: "http://img/k" } } });
    const p = await PROVIDERS.kakao.fetchProfile({ access_token: "t" }, fetchImpl);
    expect(p).toEqual({ providerUserId: "12345", email: "k@k.com", displayName: "카톡", avatarUrl: "http://img/k" });
  });
  it("line: id_token 클레임을 정규화", async () => {
    const id_token = makeJwt({ sub: "l-9", name: "라인", email: "l@l.com", picture: "http://img/l" });
    const p = await PROVIDERS.line.fetchProfile({ access_token: "t", id_token }, (() => { throw new Error("no fetch"); }) as unknown as FetchLike);
    expect(p).toEqual({ providerUserId: "l-9", email: "l@l.com", displayName: "라인", avatarUrl: "http://img/l" });
  });
});
