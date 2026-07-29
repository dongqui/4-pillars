// 프롬프트 기반 생성기. 프롬프트 조립은 여기서 끝나고, 실제 LLM 호출은
// 주입받은 transport 하나로 빠져 있다 — 어떤 모델을 쓸지는 이 파일 밖 문제다.

import type { SajuAnalysis } from "@/lib/saju-core";
import { assign, type Interpretation, type SectionKey } from "./sections";
import { buildSectionRequest, type PromptContext, type SectionRequest } from "./prompt";
import type { GenerationContext, InterpretationGenerator } from "./types";

/**
 * LLM 호출부. tool 호출의 input(`{ content: ... }`)을 그대로 돌려주면 된다.
 * 실패는 예외로 던진다 — 해당 섹션만 버려지고 나머지는 살아남는다.
 */
export type SectionTransport = (req: SectionRequest) => Promise<unknown>;

/** 계약대로 `{ content }` 로 감싸여 왔는지 확인하고 벗긴다. 아니면 undefined. */
function unwrapContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !("content" in raw)) return undefined;
  return (raw as { content: unknown }).content;
}

export class PromptedGenerator implements InterpretationGenerator {
  constructor(
    readonly model: string,
    private readonly transport: SectionTransport,
    /** 세운 연수 등 프롬프트 조립 옵션. 기본값은 buildSectionRequest 가 정한다. */
    private readonly options: Omit<PromptContext, "year"> = {},
  ) {}

  async generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
    ctx: GenerationContext,
  ): Promise<Partial<Interpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 요청에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          const raw = await this.transport(
            buildSectionRequest(analysis, key, { ...this.options, year: ctx.year }),
          );
          return { key, content: unwrapContent(raw) };
        } catch (e) {
          console.warn(`[PromptedGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
      }),
    );

    const out: Partial<Interpretation> = {};
    for (const result of settled) {
      if (!result || result.content === undefined) continue;
      // 스키마 검증은 하지 않는다 — handleSaju 가 응답·저장 직전에 한 곳에서 건다.
      // 어댑터마다 검증을 두면 한쪽이 새는 걸 못 막는다.
      assign(out, result.key, result.content as Interpretation[SectionKey]);
    }
    return out;
  }
}
