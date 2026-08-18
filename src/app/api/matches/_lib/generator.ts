// 궁합 생성기. 프롬프트 조립은 prompt/ 에서 끝나고 여기서는 transport 로 옮기기만 한다.

import { createDeepSeekTransport } from "@/app/api/saju/_lib/deepseek";
import { MODEL } from "@/app/api/saju/_lib/generator";
import { assignMatch, type MatchInterpretation, type MatchSectionKey } from "./sections";
import { buildMatchSectionRequest, type MatchContext, type MatchSectionRequest } from "./prompt";

export type MatchTransport = (req: MatchSectionRequest) => Promise<unknown>;

export interface MatchGenerator {
  readonly model: string;
  generateSections(
    ctx: MatchContext,
    keys: MatchSectionKey[],
  ): Promise<Partial<MatchInterpretation>>;
}

function unwrapContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !("content" in raw)) return undefined;
  return (raw as { content: unknown }).content;
}

export class PromptedMatchGenerator implements MatchGenerator {
  constructor(
    readonly model: string,
    private readonly transport: MatchTransport,
  ) {}

  async generateSections(
    ctx: MatchContext,
    keys: MatchSectionKey[],
  ): Promise<Partial<MatchInterpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 열람에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          return { key, content: unwrapContent(await this.transport(buildMatchSectionRequest(ctx, key))) };
        } catch (e) {
          console.warn(`[PromptedMatchGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
      }),
    );

    const out: Partial<MatchInterpretation> = {};
    for (const result of settled) {
      if (!result || result.content === undefined) continue;
      // 스키마 검증은 하지 않는다 — produceMatchSections 가 저장 직전에 한 곳에서 건다.
      assignMatch(out, result.key, result.content as MatchInterpretation[MatchSectionKey]);
    }
    return out;
  }
}

export function createMatchGenerator(
  env: Record<string, string | undefined> = process.env,
): MatchGenerator {
  const apiKey = env.DEEP_SEEK_API_KEY;
  // stub 으로 조용히 물러서지 않는다 — 자리표시자 문구가 그대로 사용자에게 나간다.
  if (!apiKey) throw new Error("DEEP_SEEK_API_KEY 가 설정되지 않았습니다");
  return new PromptedMatchGenerator(MODEL, createDeepSeekTransport({ apiKey, model: MODEL }));
}
