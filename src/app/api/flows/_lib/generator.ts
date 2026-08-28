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

/**
 * 섹션 하나에 허용하는 최대 전송 횟수(첫 시도 포함).
 *
 * 한 번 열람에 9개 요청이 동시에 나가는데, 그중 하나가 429·5xx·연결 끊김으로
 * 죽으면 그 섹션은 화면에서 통째로 빈다. 다음 열람에서 missing 으로 다시 잡히긴
 * 하지만, 그 사이 사용자는 번호가 01→03 으로 건너뛴 리포트를 본다 — 이용권을 쓴
 * 결과물이라 "다시 들어오면 채워집니다" 로 넘길 자리가 아니다.
 *
 * 재시도는 여기(래퍼들 안쪽)에 둔다. 바깥 produceFlowSections 에서 다시 부르면
 * gateFlowGeneration 이 한 번 더 걸려 한 번의 열람이 시간당 한도를 두 칸 먹는다.
 */
const SECTION_ATTEMPTS = 2;

/** 재시도 사이에 쉬는 시간. 429 는 곧바로 다시 찔러도 같은 답이 온다. */
const RETRY_DELAY_MS = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PromptedFlowGenerator implements FlowGenerator {
  constructor(
    readonly model: string,
    private readonly transport: FlowTransport,
    /** 테스트가 0 을 준다. 기본은 RETRY_DELAY_MS. */
    private readonly retryDelayMs: number = RETRY_DELAY_MS,
  ) {}

  async generateSections(
    ctx: FlowContext,
    keys: FlowSectionKey[],
  ): Promise<Partial<FlowInterpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 끝내 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 열람에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(keys.map((key) => this.sendSection(ctx, key)));

    const out: Partial<FlowInterpretation> = {};
    for (const result of settled) {
      if (!result || result.content === undefined) continue;
      // 스키마 검증은 하지 않는다 — produceFlowSections 가 저장 직전에 한 곳에서 건다.
      // 그래서 여기 재시도가 잡는 것은 **전송 실패뿐**이다. 모델이 스키마를 어긴
      // 응답은 여기선 성공으로 보이고 뒤에서 버려진다(그쪽은 화면의 안내가 받는다).
      assignFlow(out, result.key, result.content as FlowInterpretation[FlowSectionKey]);
    }
    return out;
  }

  private async sendSection(
    ctx: FlowContext,
    key: FlowSectionKey,
  ): Promise<{ key: FlowSectionKey; content: unknown } | null> {
    // 요청 조립은 시도마다 같다 — 한 번만 만든다.
    const req = buildFlowSectionRequest(ctx, key);

    for (let attempt = 1; attempt <= SECTION_ATTEMPTS; attempt++) {
      try {
        return { key, content: unwrapContent(await this.transport(req)) };
      } catch (e) {
        if (attempt === SECTION_ATTEMPTS) {
          console.warn(`[PromptedFlowGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
        console.warn(`[PromptedFlowGenerator] 섹션 생성 실패, 재시도: ${key}`, e);
        await sleep(this.retryDelayMs);
      }
    }
    return null;
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
