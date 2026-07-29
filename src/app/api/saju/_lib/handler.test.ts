import { describe, it, expect, vi } from "vitest";
import { handleSaju, type HandlerDeps } from "./handler";
import { StubGenerator } from "./generate";
import type { SajuResponse } from "./types";

const validBody = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
};

const overview = { headline: "캐시", summary: "캐시된 요약", keywords: ["a", "b", "c"] };
const yearlyLuck = [{ title: "t", desc: "d" }];

const empty = { have: {}, missing: [] as never[] };

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
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

describe("handleSaju", () => {
  it("캐시 HIT: generator/putCached 호출 없이 cached=true", async () => {
    const d = deps({
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: true, interpretation: { overview } });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("캐시 MISS: 없는 섹션만 생성해 저장하고 cached=false", async () => {
    const d = deps();
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: false });
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("일부만 캐시에 있으면 나머지만 생성기에 요청한다", async () => {
    const gen = { model: "stub", generateSections: vi.fn().mockResolvedValue({}) };
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
      generator: gen,
    });
    await handleSaju(validBody, d);
    expect(gen.generateSections).toHaveBeenCalledWith(
      expect.anything(),
      ["personality"],
      { year: 2026 },
    );
  });

  it("캐시에 있던 섹션과 새로 생성한 섹션을 합쳐 응답한다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
    });
    const res = await handleSaju(validBody, d);
    const body = res.body as SajuResponse;
    expect(Object.keys(body.interpretation).sort()).toEqual(["overview", "personality"]);
  });

  it("luck 섹션은 luck 저장소로 간다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: {}, missing: ["yearlyLuck"] }),
    });
    await handleSaju(validBody, d);
    expect(d.putLuckSections).toHaveBeenCalledOnce();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("luck 캐시 HIT 도 cached=true 에 반영된다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: { yearlyLuck }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await handleSaju(validBody, d);
    expect(res.body).toMatchObject({ cached: true, interpretation: { yearlyLuck } });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
  });

  it("생성기가 일부 섹션을 빠뜨려도 나머지로 200 을 준다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview", "personality"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockResolvedValue({ overview }),
      },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(Object.keys((res.body as SajuResponse).interpretation)).toEqual(["overview"]);
  });

  it("생성기가 스키마에 안 맞는 섹션을 주면 응답에서도 저장에서도 빠진다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps({
      sectionKeys: ["overview"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
      generator: {
        model: "stub",
        // keywords 가 빠져 overview 스키마를 통과하지 못한다.
        generateSections: vi.fn().mockResolvedValue({ overview: { headline: "h", summary: "s" } }),
      },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect((res.body as SajuResponse).interpretation).toEqual({});
    expect(d.putCached).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("overview"));
    warn.mockRestore();
  });

  it("일부는 유효하고 일부는 스키마 불통과면 유효한 것만 응답·저장된다", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview", "personality"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockResolvedValue({
          overview: { headline: "h", summary: "s", keywords: ["a", "b", "c"] },
          // personality 는 TitledText[] 여야 하는데 객체를 줬다.
          personality: { title: "t", body: "b" },
        }),
      },
    });
    const res = await handleSaju(validBody, d);
    const body = res.body as SajuResponse;
    expect(Object.keys(body.interpretation)).toEqual(["overview"]);
    expect(d.putCached).toHaveBeenCalledOnce();
    const putArg = vi.mocked(d.putCached).mock.calls[0][0];
    expect(Object.keys(putArg.interpretation)).toEqual(["overview"]);
    vi.restoreAllMocks();
  });

  it("유효한 섹션은 그대로 응답·저장된다", async () => {
    const d = deps({
      sectionKeys: ["overview"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
      generator: {
        model: "stub",
        generateSections: vi
          .fn()
          .mockResolvedValue({ overview: { headline: "h", summary: "s", keywords: ["a", "b", "c"] } }),
      },
    });
    const res = await handleSaju(validBody, d);
    expect((res.body as SajuResponse).interpretation).toEqual({
      overview: { headline: "h", summary: "s", keywords: ["a", "b", "c"] },
    });
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("요청하지 않은 섹션을 생성기가 반환해도 응답·저장에 섞이지 않는다", async () => {
    const d = deps({
      sectionKeys: ["overview"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockResolvedValue({
          overview: { headline: "h", summary: "s", keywords: ["a", "b", "c"] },
          // personality 는 요청(sectionKeys/missing)에 없었다.
          personality: [{ title: "t", body: "b" }],
        }),
      },
    });
    const res = await handleSaju(validBody, d);
    const body = res.body as SajuResponse;
    expect(Object.keys(body.interpretation)).toEqual(["overview"]);
    const putArg = vi.mocked(d.putCached).mock.calls[0][0];
    expect(Object.keys(putArg.interpretation)).toEqual(["overview"]);
  });

  it("잘못된 입력 → 400", async () => {
    const res = await handleSaju({ ...validBody, gender: "x" }, deps());
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("계산 불가한 날짜 → 422", async () => {
    const res = await handleSaju({ ...validBody, month: 2, day: 31 }, deps());
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("error");
  });

  it("생성 자체가 실패하면 → 502, 저장 미호출", async () => {
    const d = deps({
      generator: {
        model: "stub",
        generateSections: vi.fn().mockRejectedValue(new Error("LLM down")),
      },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(502);
    expect(d.putCached).not.toHaveBeenCalled();
  });
});
