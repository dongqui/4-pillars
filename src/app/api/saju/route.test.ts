import { describe, it, expect, vi, beforeEach } from "vitest";

const getCached = vi.fn();
const putCached = vi.fn();
const getLuckCached = vi.fn();
const putLuckSections = vi.fn();
// importOriginal 로 감싸는 이유: handler.ts 가 같은 모듈에서 toSectionWrites 를
// 가져다 쓴다 — 통째로 목으로 바꾸면 그게 사라져 핸들러가 런타임에 죽는다.
// 단, 이 파일의 테스트는 route.ts 가 FREE_SECTION_KEYS(전부 storage:"chart")만
// 요청하는 한 produced.luck.length > 0 분기(toSectionWrites 를 실제로 부르는
// 경로)에 닿지 않는다. 즉 여기서는 이 스프레드가 아직 회귀를 못 잡는다 —
// 그 경로는 handler.test.ts 의 "luck 섹션은 luck 저장소로 간다" 가 (./store 를
// 전혀 목하지 않으므로) 실제 toSectionWrites 로 커버한다. route.ts 가 유료
// 섹션 키를 요청하게 되기 전까지는 지우지 말 것 — 지금 지워도 이 파일의
// 테스트는 그대로 통과한다.
vi.mock("./_lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_lib/store")>()),
  getCached: (...a: unknown[]) => getCached(...a),
  putCached: (...a: unknown[]) => putCached(...a),
}));
vi.mock("./_lib/store-luck", () => ({
  getLuckCached: (...a: unknown[]) => getLuckCached(...a),
  putLuckSections: (...a: unknown[]) => putLuckSections(...a),
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
    getLuckCached.mockReset().mockResolvedValue({ have: {}, missing: [] });
    putLuckSections.mockReset().mockResolvedValue(undefined);
  });

  it("캐시 MISS 시 200 + cached:false", async () => {
    getCached.mockResolvedValue({ have: {}, missing: ["overview"] });
    putCached.mockResolvedValue(undefined);
    const res = await POST(post(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.name).toBe("홍길동");
    expect(json.interpretation.overview.headline).toBeTruthy();
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

  it("putCached 실패도 500으로 감싼다", async () => {
    getCached.mockResolvedValue({ have: {}, missing: ["overview"] });
    putCached.mockRejectedValue(new Error("db write fail"));
    const res = await POST(post(validBody));
    expect(res.status).toBe(500);
  });
});
