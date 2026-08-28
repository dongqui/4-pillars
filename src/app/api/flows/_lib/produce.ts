import {
  assignFlow,
  isFlowSectionKey,
  safeParseFlowSectionContent,
  shapeOf,
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
   * 예전에는 여기가 getStored 함수 주입이었다. 08(변곡점)의 스키마 컨텍스트를
   * 읽기와 검증이 같은 값으로 쓰도록 강제하려고 함수 자체를 없앴는데, 08 이
   * 삭제되면서 컨텍스트도 사라졌다. 함수 주입으로 되돌리지 않는 이유는 남아
   * 있다 — 주입 함수는 안에서 무엇이든 할 수 있어 계약을 코드 구조로 보장할
   * 수 없고, client 주입이면 읽기 경로가 항상 getFlowSections 하나다.
   */
  client?: SqlClient;
}

/**
 * 저장된 서술은 그대로, 없는 것만 생성·검증·저장.
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
  const { have, missing } = await getFlowSections(flowId, deps.sectionKeys, deps.client);
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
    const parsed = safeParseFlowSectionContent(key, raw);
    if (!parsed.ok) {
      // 두 가지를 함께 남긴다: 어디가 틀렸는지(이유)와 모델이 준 모양. 실패의
      // 태반이 개수 문제라 이 둘이면 로그만 보고 원인이 좁혀진다.
      console.warn(
        `[produceFlowSections] 스키마 검증 실패, 버림: ${key}` +
          `\n  이유: ${parsed.reason}` +
          `\n  받은 모양: ${shapeOf(raw)}`,
      );
      continue;
    }
    assignFlow(clean, key, parsed.content);
  }

  await deps.putStored(flowId, clean, deps.generator.model);
  return { interpretation: { ...have, ...clean }, stored: false };
}
