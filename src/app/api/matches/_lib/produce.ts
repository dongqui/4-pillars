import {
  assignMatch,
  isMatchSectionKey,
  parseMatchSectionContent,
  type MatchInterpretation,
  type MatchSectionKey,
} from "./sections";
import type { MatchContext } from "./prompt";
import type { MatchGenerator } from "./generator";
import type { StoredMatchSections } from "./store";

/**
 * 생성기 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다.
 * partial 은 실패 직전 저장소에서 읽어 둔 섹션들이다 — 싣지 않으면 이미 확보한
 * 서술까지 통째로 잃는다.
 */
export class MatchGenerationError extends Error {
  constructor(
    cause: unknown,
    readonly partial: Partial<MatchInterpretation>,
  ) {
    super("궁합 해석 생성에 실패했습니다", { cause });
    this.name = "MatchGenerationError";
  }
}

export interface ProduceMatchDeps {
  generator: MatchGenerator;
  getStored: (matchId: string, keys: MatchSectionKey[]) => Promise<StoredMatchSections>;
  putStored: (
    matchId: string,
    interpretation: Partial<MatchInterpretation>,
    model: string,
  ) => Promise<void>;
  sectionKeys: MatchSectionKey[];
}

/**
 * 저장된 서술은 그대로, 없는 것만 생성·검증·저장.
 *
 * 리포트의 produceSections 와 다른 점은 키가 하나(matchId)라는 것뿐이다 —
 * 캐시가 아니라 결과 저장이라 chart/luck 처럼 저장소가 갈리지 않는다.
 */
export async function produceMatchSections(
  matchId: string,
  ctx: MatchContext,
  deps: ProduceMatchDeps,
): Promise<{ interpretation: Partial<MatchInterpretation>; stored: boolean }> {
  const { have, missing } = await deps.getStored(matchId, deps.sectionKeys);
  if (missing.length === 0) return { interpretation: have, stored: true };

  let generated: Partial<MatchInterpretation>;
  try {
    generated = await deps.generator.generateSections(ctx, missing);
  } catch (e) {
    throw new MatchGenerationError(e, have);
  }

  // 생성기가 준 값은 무엇이든 여기서 한 번 걸러야 한다. 이 결과가 화면과 저장
  // 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  const clean: Partial<MatchInterpretation> = {};
  for (const [key, raw] of Object.entries(generated)) {
    if (!isMatchSectionKey(key)) continue;
    const content = parseMatchSectionContent(key, raw);
    if (content === null) {
      console.warn(`[produceMatchSections] 스키마 검증 실패, 버림: ${key}`);
      continue;
    }
    assignMatch(clean, key, content);
  }

  // clean 이 비면(전부 검증 실패) DB 를 부르지 않는다 — putMatchSections 자체도
  // 빈 interpretation 이면 무해하지만, 호출 자체를 건너뛰어 의도를 분명히 한다.
  if (Object.keys(clean).length > 0) {
    await deps.putStored(matchId, clean, deps.generator.model);
  }

  return { interpretation: { ...have, ...clean }, stored: false };
}
