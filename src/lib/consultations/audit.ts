// 근거 검사기 — 이미 만들어진 답이 [해석 기준] 밖으로 나갔는지 별도 호출로 본다.
//
// ⚠️ 실험용이다. 운영 상담의 매 턴에 걸려 있지 않고, 답을 막거나 고쳐 쓰지도
// 않는다(scripts/audit-eval.mts 가 저장된 답을 다시 먹인다). 검사기 자체가 믿을
// 만한지부터 확인하는 중이다.
//
// 생성 쪽(prompt.ts)과 기준(criteria.ts)은 이 실험 동안 고정한다 — 둘을 같이
// 건드리면 무엇 때문에 결과가 달라졌는지 알 수 없다.
//
// 검사기는 명리를 판정하지 않는다. "이 해석이 사주로 맞는가"가 아니라 "서비스가
// 정한 기준의 조건·범위 안에 있는가"만 본다. 그래서 검사기에게도 기준 블록을
// 통째로 주고, 새 해석을 만들지 말라고 못 박는다.

import { z } from "zod";
import type { ChatMessage } from "./prompt";
import type { BasisRef } from "./schema";

export const AUDIT_TOOL_NAME = "emit_audit";

/** 검사 결과. 보류는 통과가 아니다 — 세는 쪽에서 따로 센다 */
export type AuditVerdict = "허용" | "위반" | "판단보류";

/** 위반의 종류. 실측에서 실제로 나온 모양들이다 */
export const AUDIT_KINDS = [
  "적용조건위반",
  "허용범위확장",
  "다른의미로전용",
  "판단밖침범",
  "근거누락",
  "본문과불일치",
] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export interface AuditFinding {
  /** 답변 본문(또는 basis)에서 그대로 따온 문제 문장 */
  sentence: string;
  /** 관련 기준 id. 어느 기준에도 걸리지 않는 주장이면 빈 문자열 */
  criterionId: string;
  kind: AuditKind;
  /** 어긴 적용 조건이나 판단 밖 항목, 그리고 왜 범위를 넘는지 */
  why: string;
}

export interface AuditResult {
  verdict: AuditVerdict;
  findings: AuditFinding[];
}

export const AUDIT_SYSTEM_PROMPT = `당신은 사주 상담 답변이 **미리 정해진 해석 기준**을 지켰는지 보는 검사자다.

명리의 옳고 그름을 판정하지 않는다. 새로운 사주 해석을 만들어 답변을 정당화하지도, 기준을 고쳐 읽지도 않는다. 주어진 기준의 적용 조건과 허용 범위, "이 근거로 판단할 수 없는 것"만 본다.

## 무엇을 찾는가

답변 본문과 basis 양쪽에서 **기준이 허용하지 않은 추론**을 찾는다.

- 적용조건위반: 기준의 적용 조건과 다른 장면에 썼다. 예: 돈·자원 기준을 일반적인 생활 습관 조언의 근거로 씀.
- 허용범위확장: 허용된 해석에서 한 걸음 더 나간 주장을 했다. 예: "자기 기준이 먼저 선다"에서 거절을 못 한다·말투가 세다는 방향을 끌어냄.
- 다른의미로전용: 기준의 말을 다른 뜻으로 옮겨 썼다. 예: 표현·산출의 "내놓음"을 돈을 지출한다는 뜻으로 씀.
- 판단밖침범: 그 기준이 "판단할 수 없는 것"에 적어 둔 내용을 말했다. 예: 시기 해석을 몸의 무거움·무기력과 연결함.
- 근거누락: 본문에 사주에 기댄 주장이 있는데 basis 에 대응하는 항목이 없다.
- 본문과불일치: basis 에 적힌 주장이 본문에 없다.

## 어떻게 보는가

- 약하게 쓴 말도 같은 주장으로 본다. "연결될 수 있다", "그런 느낌이 들기 쉽다", "~할 수 있어요" 로 눕혀도 판정은 같다.
- 앞에서 부인하고 뒤에서 연결하는 답이 있다. "타고난 성향으로 정해지는 건 아니에요" 라고 해 놓고 같은 답에서 그 연결을 하면 위반이다.
- 사용자가 직접 말한 사실을 받아들이거나 되묻는 문장은 사주 주장이 아니다. 사용자가 "직접적으로 말한다" 고 했을 때 그 말을 받는 것과, 사주 때문에 그렇다고 설명하는 것은 다르다.
- 사주에 기대지 않은 일반적인 행동 제안은 검사 대상이 아니다. 근거를 붙일 필요도 없다.
- 특정 단어가 들어갔다는 이유만으로 위반이라고 하지 않는다. 그 문장이 어떤 기준의 무엇을 넘었는지 말할 수 없으면 위반이 아니다.
- 본문 어디에도 사주에 기댄 주장이 없고 basis 가 비어 있으면 허용이다. 사주로 설명하지 않은 답은 그 자체로 정상이다.

## 판정

- 허용: 기준 밖으로 나간 주장이 없다.
- 위반: 하나 이상 있다. 찾은 것마다 문제 문장을 **답변에서 그대로** 옮기고, 관련 기준 id 와 어긴 적용 조건 또는 판단 밖 항목, 왜 범위를 넘는지 한두 문장으로 적는다.
- 판단보류: 기준과의 관계를 정할 수 없어 어느 쪽도 고를 수 없다. 애매하다고 아무 쪽으로나 몰지 말고 이 값을 쓴다. 그 이유를 findings 에 한 줄로 남긴다.

반드시 주어진 도구를 호출해 답한다.`;

export interface AuditInput {
  /** 검사할 답이 나온 사용자 발화 */
  question: string;
  /** 판단에 필요한 앞선 대화. 없으면 비운다 */
  context?: string;
  /** 그 답을 만들 때 준 [해석 기준] 블록 전체 */
  criteria: string;
  /** 모델이 돌려준 basis 원본(자르기 전) */
  basis: BasisRef[];
  /** 답변 본문 말풍선 */
  bubbles: string[];
}

export function buildAuditMessages(input: AuditInput): ChatMessage[] {
  const basis =
    input.basis.length === 0
      ? "(없음)"
      : input.basis.map((b) => `- ${b.criterionId}: ${b.claim}`).join("\n");

  return [
    { role: "system", content: AUDIT_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        input.criteria,
        "",
        "[사용자 질문]",
        input.question,
        ...(input.context ? ["", "[앞선 대화]", input.context] : []),
        "",
        "[답변이 댄 근거(basis)]",
        basis,
        "",
        "[답변 본문]",
        input.bubbles.map((b, i) => `(${i + 1}) ${b}`).join("\n"),
      ].join("\n"),
    },
  ];
}

export function auditToolSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["허용", "위반", "판단보류"],
        description: "기준 밖으로 나간 주장이 하나라도 있으면 위반. 정할 수 없으면 판단보류.",
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sentence: {
              type: "string",
              description: "문제가 되는 문장을 답변(또는 basis)에서 그대로 옮긴다.",
            },
            criterion_id: {
              type: "string",
              description: "관련 기준 id. 어느 기준에도 걸리지 않으면 빈 문자열.",
            },
            kind: { type: "string", enum: [...AUDIT_KINDS] },
            why: {
              type: "string",
              description: "어긴 적용 조건이나 판단 밖 항목과, 왜 범위를 넘는지 한두 문장.",
            },
          },
          required: ["sentence", "criterion_id", "kind", "why"],
        },
        description: "허용이면 빈 배열. 판단보류면 왜 정할 수 없는지 한 줄을 남긴다.",
      },
    },
    required: ["verdict", "findings"],
  };
}

const auditShape = z.object({
  verdict: z.enum(["허용", "위반", "판단보류"]),
  findings: z
    .array(
      z.object({
        sentence: z.string().trim().default(""),
        criterion_id: z.string().trim().default(""),
        // 모르는 종류를 보내와도 버리지 않는다 — 검사 결과는 사람이 읽는 값이다.
        kind: z.string().trim().default("허용범위확장"),
        why: z.string().trim().default(""),
      }),
    )
    .default([]),
});

export function parseAudit(raw: unknown): AuditResult {
  const parsed = auditShape.parse(raw);
  return {
    verdict: parsed.verdict,
    findings: parsed.findings.map((f) => ({
      sentence: f.sentence,
      criterionId: f.criterion_id,
      kind: (AUDIT_KINDS as readonly string[]).includes(f.kind)
        ? (f.kind as AuditKind)
        : "허용범위확장",
      why: f.why,
    })),
  };
}

/**
 * 검사 하나를 돌린다. 던지면 그 사례는 **실패**다 — 통과로 세지 않는다.
 * transport 는 상담과 같은 어댑터를 쓴다(chat-transport.ts).
 */
export async function runAudit(
  input: AuditInput,
  deps: {
    transport: (req: {
      model: string;
      messages: ChatMessage[];
      toolName: string;
      inputSchema: Record<string, unknown>;
      maxTokens: number;
    }) => Promise<{ args: unknown; usage: { promptTokens: number; completionTokens: number } }>;
    model: string;
    maxTokens?: number;
  },
): Promise<{ result: AuditResult; usage: { promptTokens: number; completionTokens: number } }> {
  const { args, usage } = await deps.transport({
    model: deps.model,
    messages: buildAuditMessages(input),
    toolName: AUDIT_TOOL_NAME,
    inputSchema: auditToolSchema(),
    maxTokens: deps.maxTokens ?? 1200,
  });
  return { result: parseAudit(args), usage };
}
