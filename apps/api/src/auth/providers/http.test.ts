import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "./http.js";

describe("decodeJwtPayload", () => {
  it("JWT payload를 디코드한다", () => {
    const payload = { sub: "123", email: "a@b.com" };
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = `${b64({ alg: "none" })}.${b64(payload)}.sig`;
    expect(decodeJwtPayload(jwt)).toEqual(payload);
  });
});
