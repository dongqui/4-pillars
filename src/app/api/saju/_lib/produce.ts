import type { SajuAnalysis } from "@/lib/saju-core";
import { chartKey, luckKey, pillarsJson } from "./key";
import { toSectionWrites, type CachedSections, type CacheRecord, type SectionWrite } from "./store";
import {
  assign,
  isSectionKey,
  parseSectionContent,
  sectionStorage,
  type Interpretation,
  type SectionKey,
} from "./sections";
import type { InterpretationGenerator } from "./types";

/**
 * 생성기(LLM) 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다
 * (라우트는 502, 리포트는 캐시된 것만으로 계속).
 *
 * partial 은 실패 직전 캐시에서 읽어둔 섹션들이다. 이걸 싣지 않으면 호출자가
 * 이미 확보한 해석까지 통째로 잃는다.
 */
export class GenerationError extends Error {
  constructor(
    cause: unknown,
    readonly partial: Partial<Interpretation>,
  ) {
    super("해석 생성에 실패했습니다", { cause });
    this.name = "GenerationError";
  }
}

export interface ProduceDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putLuckSections: (luckKey: string, sections: SectionWrite[], model: string) => Promise<void>;
  /** 요청할 섹션. 무료/유료 결정은 호출자 몫이다. */
  sectionKeys: SectionKey[];
  /** 세운·대운의 기준 연도 */
  year: number;
}

const splitByStorage = (keys: SectionKey[]) => ({
  chart: keys.filter((k) => sectionStorage(k) === "chart"),
  luck: keys.filter((k) => sectionStorage(k) === "luck"),
});

/**
 * 해석 섹션을 확보한다: 캐시에 있는 건 그대로, 없는 것만 생성·검증·저장.
 * 입력 파싱도 상태 코드 매핑도 하지 않는다 — 그건 호출자 몫이다.
 */
export async function produceSections(
  analysis: SajuAnalysis,
  deps: ProduceDeps,
): Promise<{ interpretation: Partial<Interpretation>; cached: boolean }> {
  // 저장소가 갈리므로 두 곳을 함께 본다 (DB 오류는 상위로 전파)
  const wanted = splitByStorage(deps.sectionKeys);
  const cKey = chartKey(analysis.chart);
  const lKey = luckKey(analysis, deps.year);
  const [chartCache, luckCache] = await Promise.all([
    deps.getCached(cKey, wanted.chart),
    deps.getLuckCached(lKey, wanted.luck),
  ]);

  const interpretation: Partial<Interpretation> = { ...chartCache.have, ...luckCache.have };
  const missing = [...chartCache.missing, ...luckCache.missing];

  if (missing.length === 0) return { interpretation, cached: true };

  // 없는 섹션만 생성. 생성기가 일부를 빠뜨려도 나머지로 진행한다
  // (섹션 단위 실패는 다음 요청에서 missing 으로 다시 잡힌다).
  let generated: Partial<Interpretation>;
  try {
    generated = await deps.generator.generateSections(analysis, missing, { year: deps.year });
  } catch (e) {
    throw new GenerationError(e, interpretation);
  }

  // 생성기가 반환한 값은 무엇이든 여기서 한 번 걸러야 한다 — 이 결과가 응답과
  // 저장 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  //  - missing 에 없는 키는 버린다: 요청하지 않은 섹션이 섞이거나
  //    이미 검증된 캐시 값을 덮어쓰지 않게 한다.
  //  - 자기 스키마에 안 맞는 값은 버리고 warn: 어댑터의 규율에 기대지 않고
  //    여기서 막는다. 떨어진 섹션은 다음 요청에서 다시 시도된다.
  const validated: Partial<Interpretation> = {};
  for (const key of missing) {
    const raw = generated[key];
    if (raw === undefined) continue;
    const parsed = parseSectionContent(key, raw);
    if (parsed === null) {
      console.warn(`[produceSections] 섹션 검증 실패, 건너뜀: ${key}`);
      continue;
    }
    assign(validated, key, parsed);
  }
  Object.assign(interpretation, validated);

  // 저장 (멱등) — 검증까지 통과한 것만, 저장소별로 나눠서
  const produced = splitByStorage(Object.keys(validated).filter(isSectionKey));
  const chartProduced = Object.fromEntries(
    produced.chart.map((k) => [k, validated[k]]),
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
      toSectionWrites(Object.fromEntries(produced.luck.map((k) => [k, validated[k]]))),
      deps.generator.model,
    );
  }

  return { interpretation, cached: false };
}
