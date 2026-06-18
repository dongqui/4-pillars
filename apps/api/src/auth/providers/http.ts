/* eslint-disable @typescript-eslint/no-explicit-any */

export async function postForm(
  url: string,
  params: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`token endpoint ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`userinfo ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** 서명 검증 없이 JWT payload만 디코드한다. */
export function decodeJwtPayload(jwt: string): any {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("invalid jwt");
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}
