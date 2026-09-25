import { describe, it, expect } from "vitest";
import {
  AUDIT_SYSTEM_PROMPT,
  AUDIT_TOOL_NAME,
  auditToolSchema,
  buildAuditMessages,
  parseAudit,
  runAudit,
} from "./audit";

const input = {
  question: "회사 사람들한테 싫은 소리를 못 하겠어요.",
  criteria: "[해석 기준]\n### no-gwanseong (원국)",
  basis: [{ criterionId: "no-gwanseong", claim: "자기 기준이 먼저 선다" }],
  bubbles: ["자기 기준이 먼저 서는 편이에요"],
};

describe("buildAuditMessages", () => {
  it("기준 블록·질문·근거·본문을 한 메시지에 싣는다", () => {
    const m = buildAuditMessages(input);
    expect(m[0].role).toBe("system");
    expect(m[1].content).toContain("[해석 기준]");
    expect(m[1].content).toContain("회사 사람들한테");
    expect(m[1].content).toContain("no-gwanseong: 자기 기준이 먼저 선다");
    expect(m[1].content).toContain("(1) 자기 기준이 먼저 서는 편이에요");
  });

  it("근거가 없으면 없다고 적는다 — 빈 칸을 남기지 않는다", () => {
    expect(buildAuditMessages({ ...input, basis: [] })[1].content).toContain("(없음)");
  });

  it("앞선 대화는 있을 때만 붙인다", () => {
    expect(buildAuditMessages(input)[1].content).not.toContain("[앞선 대화]");
    expect(buildAuditMessages({ ...input, context: "직전에 두 가지를 물었다" })[1].content).toContain(
      "[앞선 대화]",
    );
  });
});

describe("AUDIT_SYSTEM_PROMPT", () => {
  it("명리 타당성이 아니라 기준 준수를 본다고 못박는다", () => {
    expect(AUDIT_SYSTEM_PROMPT).toContain("새로운 사주 해석을 만들어 답변을 정당화하지도");
    expect(AUDIT_SYSTEM_PROMPT).toContain("기준을 고쳐 읽지도 않는다");
  });

  it("약하게 쓴 말도 같은 주장으로 보라고 한다", () => {
    expect(AUDIT_SYSTEM_PROMPT).toContain("연결될 수 있다");
  });

  // 무엇이든 위반이라고 하는 검사기를 막는 쪽이다.
  it("사용자가 말한 사실과 일반 제안은 검사 대상이 아니라고 적는다", () => {
    expect(AUDIT_SYSTEM_PROMPT).toContain("사용자가 직접 말한 사실");
    expect(AUDIT_SYSTEM_PROMPT).toContain("특정 단어가 들어갔다는 이유만으로");
  });
});

describe("auditToolSchema", () => {
  it("판정을 세 값으로 묶는다 — 보류가 통과로 접히면 안 된다", () => {
    const p = auditToolSchema().properties as Record<string, { enum?: unknown[] }>;
    expect(p.verdict.enum).toEqual(["허용", "위반", "판단보류"]);
  });

  it("문제 문장·기준 id·종류·이유를 모두 요구한다", () => {
    const p = auditToolSchema().properties as Record<string, { items?: { required?: string[] } }>;
    expect(p.findings.items?.required).toEqual(["sentence", "criterion_id", "kind", "why"]);
  });
});

describe("parseAudit", () => {
  it("판정과 문제 문장을 읽는다", () => {
    const r = parseAudit({
      verdict: "위반",
      findings: [
        {
          sentence: "싫은 소리를 꺼리는 감각과 연결될 수 있어요",
          criterion_id: "no-gwanseong",
          kind: "허용범위확장",
          why: "거절의 방향은 판단 밖이다",
        },
      ],
    });
    expect(r.verdict).toBe("위반");
    expect(r.findings[0].criterionId).toBe("no-gwanseong");
  });

  it("findings 가 빠지면 빈 배열이다", () => {
    expect(parseAudit({ verdict: "허용" }).findings).toEqual([]);
  });

  it("모르는 종류가 와도 버리지 않는다 — 결과는 사람이 읽는 값이다", () => {
    const r = parseAudit({
      verdict: "위반",
      findings: [{ sentence: "가", criterion_id: "", kind: "뭔가새로운것", why: "나" }],
    });
    expect(r.findings).toHaveLength(1);
  });

  it("판정이 세 값 밖이면 거부한다", () => {
    expect(() => parseAudit({ verdict: "아마도", findings: [] })).toThrow();
  });
});

describe("runAudit", () => {
  it("검사 tool 이름과 스키마를 실어 보낸다", async () => {
    const seen: { toolName: string }[] = [];
    const transport = async (req: { toolName: string }) => {
      seen.push(req);
      return {
        args: { verdict: "허용", findings: [] },
        usage: { promptTokens: 900, completionTokens: 40 },
      };
    };
    const r = await runAudit(input, { transport: transport as never, model: "m" });
    expect(seen[0].toolName).toBe(AUDIT_TOOL_NAME);
    expect(r.result.verdict).toBe("허용");
    expect(r.usage.promptTokens).toBe(900);
  });
});
