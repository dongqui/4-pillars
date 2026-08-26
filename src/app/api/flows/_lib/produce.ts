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
 * 구간 수는 ctx.segments.length 하나가 유일한 출처다 — getStored 도 검증도 이 값을
 * 쓴다. 저장된 서술의 구간 수가 다르면 missing 으로 잡혀 다시 생성된다.
 */
export async function produceFlowSections(
  flowId: string,
  ctx: FlowContext,
  deps: ProduceFlowDeps,
): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }> {
  const n = ctx.segments.length;
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
    const content = parseFlowSectionContent(key, raw, n);
    if (content === null) {
      console.warn(`[produceFlowSections] 스키마 검증 실패, 버림: ${key}`);
      continue;
    }
    assignFlow(clean, key, content);
  }

  await deps.putStored(flowId, clean, deps.generator.model);
  return { interpretation: { ...have, ...clean }, stored: true };
}
