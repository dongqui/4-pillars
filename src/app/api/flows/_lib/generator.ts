// 흐름 생성기. 프롬프트 조립은 prompt/ 에서 끝나고 여기서는 transport 로 옮기기만 한다.

import { createDeepSeekTransport } from "@/app/api/saju/_lib/deepseek";
import { MODEL } from "@/app/api/saju/_lib/generator";
import { assignFlow, type FlowInterpretation, type FlowSectionKey } from "./sections";
import { buildFlowSectionRequest, type FlowContext, type FlowSectionRequest } from "./prompt";

export type FlowTransport = (req: FlowSectionRequest) => Promise<unknown>;

export interface FlowGenerator {
  readonly model: string;
  generateSections(
    ctx: FlowContext,
    keys: FlowSectionKey[],
  ): Promise<Partial<FlowInterpretation>>;
}

function unwrapContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !("content" in raw)) return undefined;
  return (raw as { content: unknown }).content;
}

export class PromptedFlowGenerator implements FlowGenerator {
  constructor(
    readonly model: string,
    private readonly transport: FlowTransport,
  ) {}

  async generateSections(
    ctx: FlowContext,
    keys: FlowSectionKey[],
  ): Promise<Partial<FlowInterpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 열람에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          const raw = await this.transport(buildFlowSectionRequest(ctx, key));
          return { key, content: unwrapContent(raw) };
        } catch (e) {
          console.warn(`[PromptedFlowGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
      }),
    );

    const out: Partial<FlowInterpretation> = {};
    for (const result of settled) {
      if (!result || result.content === undefined) continue;
      // 스키마 검증은 하지 않는다 — produceFlowSections 가 저장 직전에 한 곳에서 건다.
      assignFlow(out, result.key, result.content as FlowInterpretation[FlowSectionKey]);
    }
    return out;
  }
}

export function createFlowGenerator(
  env: Record<string, string | undefined> = process.env,
): FlowGenerator {
  const apiKey = env.DEEP_SEEK_API_KEY;
  // stub 으로 조용히 물러서지 않는다 — 자리표시자 문구가 그대로 사용자에게 나간다.
  if (!apiKey) throw new Error("DEEP_SEEK_API_KEY 가 없습니다");
  return new PromptedFlowGenerator(MODEL, createDeepSeekTransport({ apiKey, model: MODEL }));
}
