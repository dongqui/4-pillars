import { analyze } from "@/lib/saju-core";
import { parseRequest, ValidationError } from "./input";
import { chartKey, luckKey, pillarsJson } from "./key";
import { toSectionWrites, type CachedSections, type CacheRecord, type SectionWrite } from "./store";
import { sectionStorage, type Interpretation, type SectionKey } from "./sections";
import type { ErrorResponse, InterpretationGenerator, SajuResponse } from "./types";

export interface HandlerDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putLuckSections: (
    luckKey: string,
    sections: SectionWrite[],
    model: string,
  ) => Promise<void>;
  /** 요청할 섹션. 무료/유료 결정은 호출자 몫이다. */
  sectionKeys: SectionKey[];
  /** 세운·대운의 기준 연도 */
  year: number;
}

export interface HandlerResult {
  status: number;
  body: SajuResponse | ErrorResponse;
}

const splitByStorage = (keys: SectionKey[]) => ({
  chart: keys.filter((k) => sectionStorage(k) === "chart"),
  luck: keys.filter((k) => sectionStorage(k) === "luck"),
});

export async function handleSaju(raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  // 1. 입력 검증
  let parsed;
  try {
    parsed = parseRequest(raw);
  } catch (e) {
    if (e instanceof ValidationError) return { status: 400, body: { error: e.message } };
    throw e;
  }

  // 2. 만세력 계산 (결정적)
  let analysis;
  try {
    analysis = analyze(parsed.input);
  } catch (e) {
    console.error("[handleSaju] 원국 계산 실패", e);
    return { status: 422, body: { error: "생년월일시를 확인해 주세요" } };
  }

  // 3. 캐시 조회 — 저장소가 갈리므로 두 곳을 함께 본다 (DB 오류는 상위로 → 500)
  const wanted = splitByStorage(deps.sectionKeys);
  const cKey = chartKey(analysis.chart);
  const lKey = luckKey(analysis, deps.year);
  const [chartCache, luckCache] = await Promise.all([
    deps.getCached(cKey, wanted.chart),
    deps.getLuckCached(lKey, wanted.luck),
  ]);

  const interpretation: Partial<Interpretation> = { ...chartCache.have, ...luckCache.have };
  const missing = [...chartCache.missing, ...luckCache.missing];

  if (missing.length === 0) {
    return {
      status: 200,
      body: { name: parsed.name, analysis, interpretation, cached: true },
    };
  }

  // 4. 없는 섹션만 생성. 생성기가 일부를 빠뜨려도 나머지로 응답한다
  //    (섹션 단위 실패는 다음 요청에서 missing 으로 다시 잡힌다).
  let generated: Partial<Interpretation>;
  try {
    generated = await deps.generator.generateSections(analysis, missing);
  } catch {
    return { status: 502, body: { error: "해석 생성에 실패했습니다" } };
  }
  Object.assign(interpretation, generated);

  // 5. 저장 (멱등) — 생성에 성공한 것만, 저장소별로 나눠서
  const produced = splitByStorage(Object.keys(generated).filter((k): k is SectionKey =>
    missing.includes(k as SectionKey),
  ));
  const chartProduced = Object.fromEntries(
    produced.chart.map((k) => [k, generated[k]]),
  ) as Partial<Interpretation>;

  if (produced.chart.length > 0) {
    await deps.putCached({
      chartKey: cKey,
      gender: analysis.chart.gender,
      pillars: pillarsJson(analysis.chart),
      interpretation: chartProduced,
      model: deps.generator.model,
    });
  }
  if (produced.luck.length > 0) {
    await deps.putLuckSections(
      lKey,
      toSectionWrites(Object.fromEntries(produced.luck.map((k) => [k, generated[k]]))),
      deps.generator.model,
    );
  }

  return {
    status: 200,
    body: { name: parsed.name, analysis, interpretation, cached: false },
  };
}
