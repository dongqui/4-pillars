import { describe, it, expect, vi } from "vitest";
import { analyze } from "@/lib/saju-core";
import { StubGenerator } from "./generate";
import { GenerationError, produceSections, type ProduceDeps } from "./produce";

const analysis = analyze({
  year: 1990, month: 5, day: 15, hour: 10, gender: "male",
});

const trait = { title: "t", body: "b", basis: "근거" };
const overview = { headline: "캐시", summary: "캐시된 요약", traits: [trait, trait, trait, trait] };
const empty = { have: {}, missing: [] as never[] };

function deps(over: Partial<ProduceDeps> = {}): ProduceDeps {
  return {
    generator: new StubGenerator(),
    getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
    putCached: vi.fn().mockResolvedValue(undefined),
    getLuckCached: vi.fn().mockResolvedValue(empty),
    putLuckSections: vi.fn().mockResolvedValue(undefined),
    sectionKeys: ["overview"],
    year: 2026,
    ...over,
  };
}

describe("produceSections", () => {
  it("캐시 HIT: 생성기·저장 호출 없이 cached=true", async () => {
    const d = deps({
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await produceSections(analysis, d);

    expect(res).toEqual({ interpretation: { overview }, cached: true });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("캐시 MISS: 없는 섹션만 생성해 저장하고 cached=false", async () => {
    const d = deps();
    const res = await produceSections(analysis, d);

    expect(res.cached).toBe(false);
    expect(res.interpretation.overview).toBeDefined();
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("luck 섹션은 luck 저장소로 간다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: {}, missing: ["yearlyLuck"] }),
    });
    await produceSections(analysis, d);

    expect(d.putLuckSections).toHaveBeenCalledOnce();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  // /report 가 "캐시에 있던 것만이라도 보여준다"를 하려면 실패 시점의 캐시가 필요하다.
  it("생성기가 실패하면 GenerationError 를 던지고, 캐시에서 읽은 섹션을 partial 로 싣는다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockRejectedValue(new Error("LLM down")),
      },
    });

    // .catch(e => e) 로 받는다 — rejects.toBeInstanceOf 만 쓰면 partial 을 못 본다.
    const err = await produceSections(analysis, d).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).partial).toEqual({ overview });
    expect(d.putCached).not.toHaveBeenCalled();
  });

  // DB 오류는 GenerationError 가 아니다 — 호출자가 502 와 500 을 갈라야 한다.
  it("캐시 조회가 실패하면 그대로 전파한다", async () => {
    const d = deps({ getCached: vi.fn().mockRejectedValue(new Error("db down")) });

    await expect(produceSections(analysis, d)).rejects.toThrow("db down");
    await expect(produceSections(analysis, d)).rejects.not.toBeInstanceOf(GenerationError);
  });
});
