// v2 생성기. 한 시도 = HTTP 요청 한 번(retries 0). 교정 호출은 B.
import {
  createDeepSeekTransport, DeepSeekHttpError, DeepSeekTimeoutError, type DeepSeekTransport,
} from "@/app/api/saju/_lib/deepseek";
import { MODEL } from "@/app/api/saju/_lib/generator";
import type { FlowGenerationInput } from "./input";
import { buildFlowReportUserV2, FLOW_REPORT_SYSTEM_V2, FLOW_REPORT_TOOL_NAME } from "./prompts";
import { validateReferences } from "./references";
import { flowReportToolSchema, flowReportV2Schema, type FlowReportV2 } from "./schema";

export type GenerateFailureCode = "transport" | "timeout" | "http" | "schema" | "references";
export type GenerateResult =
  | { ok: true; report: FlowReportV2; usage: unknown }
  | { ok: false; code: GenerateFailureCode; errors: unknown; usage: unknown };

export interface FlowReportTransport { send: DeepSeekTransport; takeUsage(): unknown }

export const FLOW_REPORT_TIMEOUT_MS = 45_000;

export function createFlowReportTransport(env: Record<string, string | undefined> = process.env): FlowReportTransport {
  const apiKey = env.DEEP_SEEK_API_KEY;
  if (!apiKey) throw new Error("DEEP_SEEK_API_KEY 가 없습니다");
  let last: unknown = null;
  const send = createDeepSeekTransport({
    apiKey, model: MODEL, retries: 0, timeoutMs: FLOW_REPORT_TIMEOUT_MS, onUsage: (_k, u) => { last = u; },
  });
  return { send, takeUsage: () => last };
}

/** 오류에서 남길 것은 이름과 상태코드뿐이다. message 에는 모델 본문이 실릴 수 있다. */
function condense(e: unknown): { code: GenerateFailureCode; errors: { name: string; status?: number } } {
  if (e instanceof DeepSeekTimeoutError) return { code: "timeout", errors: { name: e.name } };
  if (e instanceof DeepSeekHttpError) return { code: "http", errors: { name: e.name, status: e.status } };
  return { code: "transport", errors: { name: e instanceof Error ? e.name : "Error" } };
}

export async function generateFlowReportV2(input: FlowGenerationInput, transport: FlowReportTransport): Promise<GenerateResult> {
  let raw: unknown;
  try {
    raw = await transport.send({
      key: "report", system: FLOW_REPORT_SYSTEM_V2, user: buildFlowReportUserV2(input),
      toolName: FLOW_REPORT_TOOL_NAME, inputSchema: flowReportToolSchema(),
    });
  } catch (e) {
    return { ok: false, ...condense(e), usage: transport.takeUsage() };
  }
  const usage = transport.takeUsage();
  const parsed = flowReportV2Schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "schema", errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })), usage };
  }
  const missing = validateReferences(parsed.data, input.evidence);
  if (missing.length > 0) return { ok: false, code: "references", errors: missing, usage };
  return { ok: true, report: parsed.data, usage };
}
