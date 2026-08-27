import {
  assignFlow,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";
import type { FlowContext } from "./prompt";
import type { FlowGenerator } from "./generator";
import type { StoredFlowSections } from "./store";

/**
 * 생성기 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다.
 * partial 은 실패 직전 저장소에서 읽어 둔 섹션들이다 — 싣지 않으면 이미 확보한
 * 서술까지 통째로 잃는다.
 */
export class FlowGenerationError extends Error {
  constructor(
    cause: unknown,
    readonly partial: Partial<FlowInterpretation>,
  ) {
    super("흐름 해석 생성에 실패했습니다", { cause });
    this.name = "FlowGenerationError";
  }
}

export interface ProduceFlowDeps {
  generator: FlowGenerator;
  getStored: (flowId: string, keys: FlowSectionKey[]) => Promise<StoredFlowSections>;
  putStored: (
    flowId: string,
    interpretation: Partial<FlowInterpretation>,
    model: string,
  ) => Promise<void>;
  sectionKeys: FlowSectionKey[];
}

/**
 * 저장된 서술은 그대로, 없는 것만 생성·검증·저장.
 *
 * 스키마 컨텍스트는 ctx.pivotMonths 하나가 유일한 출처다 — getStored 도 검증도
 * 이 값을 쓴다. 저장된 08 의 변곡점이 다르면 missing 으로 잡혀 다시 생성된다.
 *
 * stored 는 "이미 다 있어 생성기를 아예 부르지 않았다" 만을 뜻한다(순수 캐시 적중).
 * 생성을 한 번이라도 시도했으면 그중 전부가 검증을 통과해도 false 다 — 이 값을 읽는
 * 쪽이 "이번 호출이 비용을 썼는가" 를 판단하는 근거이지 "결과가 완전한가" 를
 * 판단하는 근거가 아니다. matches 의 produceMatchSections 와 같은 계약이다.
 */
export async function produceFlowSections(
  flowId: string,
  ctx: FlowContext,
  deps: ProduceFlowDeps,
): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }> {
  // 스키마 컨텍스트의 유일한 출처다 — getStored 도 아래 검증도 이 값을 쓴다.
  // 저장된 08 의 변곡점이 다르면 missing 으로 잡혀 다시 생성된다.
  const schemaCtx = { pivotMonths: ctx.pivotMonths };
  const { have, missing } = await deps.getStored(flowId, deps.sectionKeys);
  if (missing.length === 0) return { interpretation: have, stored: true };

  let generated: Partial<FlowInterpretation>;
  try {
    generated = await deps.generator.generateSections(ctx, missing);
  } catch (e) {
    throw new FlowGenerationError(e, have);
  }

  // 생성기가 준 값은 무엇이든 여기서 한 번 걸러야 한다. 이 결과가 화면과 저장
  // 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  const clean: Partial<FlowInterpretation> = {};
  for (const [key, raw] of Object.entries(generated)) {
    if (!isFlowSectionKey(key)) continue;
    const content = parseFlowSectionContent(key, raw, schemaCtx);
    if (content === null) {
      console.warn(`[produceFlowSections] 스키마 검증 실패, 버림: ${key}`);
      continue;
    }
    assignFlow(clean, key, content);
  }

  await deps.putStored(flowId, clean, deps.generator.model);
  return { interpretation: { ...have, ...clean }, stored: false };
}
