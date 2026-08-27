import {
  assignFlow,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSchemaContext,
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
  /**
   * ctx 는 이 함수가 넘겨준다 — 호출자가 직접 스키마 컨텍스트를 조립해 넘기지
   * 않는다. produceFlowSections 아래 schemaCtx 문서에 이유가 있다.
   */
  getStored: (
    flowId: string,
    keys: FlowSectionKey[],
    ctx: FlowSchemaContext,
  ) => Promise<StoredFlowSections>;
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
 * 스키마 컨텍스트는 ctx.pivotMonths 하나가 유일한 출처이고, 그 사실이 시그니처에
 * 박혀 있다 — getStored 가 ctx 를 파라미터로 받으므로 호출자는 이 함수가 조립한
 * schemaCtx 를 그대로 받을 수밖에 없다. 예전에는 이 함수가 schemaCtx 를 로컬
 * 변수로만 들고 있고 getStored 클로저(page.tsx)가 *따로* 같은 값을 조립해
 * 넘겼다 — 둘을 묶어 주는 것이 주석뿐이라, 클로저 쪽이 나중에 다른 값을 넣어도
 * 컴파일러도 테스트도 잡지 못했다. 어긋나면 방금 쓴 08 이 다음 열람마다 "변곡점
 * 불일치" 로 missing 처리되어 매번 다시 생성된다 — 지갑은 entitlements 행이
 * 남아 안전하지만(spendTicket 이 kind:"already"), LLM 호출은 매 조회마다 든다.
 * 이제는 어긋난 값을 넘기는 호출자를 아예 쓸 수 없다.
 */
export async function produceFlowSections(
  flowId: string,
  ctx: FlowContext,
  deps: ProduceFlowDeps,
): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }> {
  // 스키마 컨텍스트의 유일한 출처다 — getStored 도 아래 검증도 이 값을 쓴다.
  // 저장된 08 의 변곡점이 다르면 missing 으로 잡혀 다시 생성된다.
  const schemaCtx = { pivotMonths: ctx.pivotMonths };
  const { have, missing } = await deps.getStored(flowId, deps.sectionKeys, schemaCtx);
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
