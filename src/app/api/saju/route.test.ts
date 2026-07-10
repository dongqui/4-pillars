import { describe, it, expect, vi, beforeEach } from "vitest";

const getCached = vi.fn();
const putCached = vi.fn();
vi.mock("./_lib/store", () => ({
  getCached: (...a: unknown[]) => getCached(...a),
  putCached: (...a: unknown[]) => putCached(...a),
}));

import { POST } from "./route";

function post(body: unknown) {
  return new Request("http://localhost/api/saju", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
};

describe("POST /api/saju", () => {
  beforeEach(() => {
    getCached.mockReset();
    putCached.mockReset();
  });

  it("캐시 MISS 시 200 + cached:false", async () => {
    getCached.mockResolvedValue(null);
    putCached.mockResolvedValue(undefined);
    const res = await POST(post(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.name).toBe("홍길동");
    expect(json.interpretation.ilgan.title).toBeTruthy();
  });

  it("본문이 JSON이 아니면 400", async () => {
    const bad = new Request("http://localhost/api/saju", {
      method: "POST",
      body: "not json{",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("DB 오류는 500으로 감싼다", async () => {
    getCached.mockRejectedValue(new Error("db down"));
    const res = await POST(post(validBody));
    expect(res.status).toBe(500);
  });
});
