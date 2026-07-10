import { describe, it, expect, vi } from "vitest";
import { handleSaju, type HandlerDeps } from "./handler";
import { StubGenerator } from "./generate";
import type { Interpretation } from "./types";

const validBody = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
};

const cachedInterp: Interpretation = {
  ilgan: { title: "캐시", body: "캐시된 본문" },
  strengths: ["s"],
  weaknesses: ["w"],
  relationships: { title: "r", body: "b" },
};

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    generator: new StubGenerator(),
    getCached: vi.fn().mockResolvedValue(null),
    putCached: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("handleSaju", () => {
  it("캐시 HIT: generator/putCached 호출 없이 cached=true", async () => {
    const d = deps({
      getCached: vi.fn().mockResolvedValue(cachedInterp),
      generator: { model: "stub", generate: vi.fn() },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: true, interpretation: cachedInterp, name: "홍길동" });
    expect(d.generator.generate).not.toHaveBeenCalled();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("캐시 MISS: generate + putCached 호출, cached=false", async () => {
    const d = deps();
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: false });
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("잘못된 입력 → 400", async () => {
    const res = await handleSaju({ ...validBody, gender: "x" }, deps());
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("생성 실패 → 502, putCached 미호출", async () => {
    const d = deps({
      generator: { model: "stub", generate: vi.fn().mockRejectedValue(new Error("LLM down")) },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(502);
    expect(d.putCached).not.toHaveBeenCalled();
  });
});
