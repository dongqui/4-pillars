import {
  assignFlow,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";
import type { FlowContext } from "./prompt";
import type { FlowGenerator } from "./generator";
import { getFlowSections, type SqlClient } from "./store";

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
  putStored: (
    flowId: string,
    interpretation: Partial<FlowInterpretation>,
    model: string,
  ) => Promise<void>;
  sectionKeys: FlowSectionKey[];
  /**
   * DB 클라이언트(주입 가능, 기본은 store.ts 의 실제 sql). 테스트만 가짜를
   * 준다 — src/lib/flows/store.test.ts, store.test.ts 와 같은 자리다.
   *
   * ⚠️ 예전에는 여기가 `getStored: (flowId, keys, ctx) => ...` 함수였다. 함수를
   * 주입받으면 그 함수 *안에서* ctx 를 무엇이든 새로 지어 getFlowSections 에
   * 넘길 수 있었다 — 타입은 "3번째 인자로 FlowSchemaContext 를 받는다" 만
   * 강제할 뿐 "받은 값을 그대로 넘긴다" 는 보장이 없다(인자가 2개뿐인 함수도
   * 구조적으로 3개짜리 함수 타입을 만족한다. 실제로 이렇게 쓰면 컴파일러가
   * 잡지 못하고, getStored 를 무엇이 부르든 모킹하는 테스트도 애초에 함수가
   * 무슨 ctx 를 받았는지 보지 않으므로 잡지 못한다). 여기서 그 함수 자체를
   * 없애고 produceFlowSections 가 getFlowSections 를 직접 부르게 하면, 읽기에
   * 쓰이는 ctx 는 검증에 쓰이는 ctx 와 같은 지역 변수(schemaCtx)일 수밖에
   * 없다 — 호출자가 끼어들 함수 자리 자체가 없다.
   */
  client?: SqlClient;
}

/**
 * 저장된 서술은 그대로, 없는 것만 생성·검증·저장.
 *
 * 스키마 컨텍스트는 ctx.pivotMonths 하나가 유일한 출처다. getFlowSections 를
 * 이 함수가 직접 부르므로(ProduceFlowDeps 문서 참고) 읽기와 검증이 같은
 * schemaCtx 지역 변수를 쓴다는 것이 코드 구조로 보장된다 — 둘을 갈라놓으려면
 * 이 함수 자체를 고쳐 서로 다른 리터럴을 두 자리에 써야 하는데,
 * produce.test.ts 의 "읽기와 검증이 같은 스키마 컨텍스트를 쓴다" 테스트가
 * 그 상태를 그대로 잡는다. 저장된 08 의 변곡점이 다르면 missing 으로 잡혀
 * 다시 생성된다.
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
  // 스키마 컨텍스트의 유일한 출처다 — 바로 아래 읽기와 그 뒤 검증이 같은 이
  // 지역 변수를 쓴다. 저장된 08 의 변곡점이 다르면 missing 으로 잡혀 다시
  // 생성된다.
  const schemaCtx = { pivotMonths: ctx.pivotMonths };
  const { have, missing } = await getFlowSections(
    flowId,
    deps.sectionKeys,
    schemaCtx,
    deps.client,
  );
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
