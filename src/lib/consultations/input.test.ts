import { describe, it, expect } from "vitest";
import { MAX_UTTERANCE_CHARS, utteranceSchema } from "./input";

describe("utteranceSchema", () => {
  it("보통 발화를 통과시킨다", () => {
    const r = utteranceSchema.safeParse({ text: "요즘 회사가 너무 힘들어요" });
    expect(r.success).toBe(true);
  });

  it("앞뒤 공백을 지운다", () => {
    const r = utteranceSchema.parse({ text: "  힘들어요  " });
    expect(r.text).toBe("힘들어요");
  });

  it("빈 발화를 거부한다", () => {
    expect(utteranceSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("공백만 있는 발화를 거부한다 — 다듬은 뒤 검사해야 잡힌다", () => {
    expect(utteranceSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("상한을 넘기면 거부한다 — 비용 상한이 여기 걸려 있다", () => {
    const long = "가".repeat(MAX_UTTERANCE_CHARS + 1);
    expect(utteranceSchema.safeParse({ text: long }).success).toBe(false);
  });

  it("상한 딱 맞는 길이는 통과한다", () => {
    const exact = "가".repeat(MAX_UTTERANCE_CHARS);
    expect(utteranceSchema.safeParse({ text: exact }).success).toBe(true);
  });

  it("문자열이 아니면 거부한다", () => {
    expect(utteranceSchema.safeParse({ text: 42 }).success).toBe(false);
  });

  it("상한은 스펙이 정한 1000 자다", () => {
    expect(MAX_UTTERANCE_CHARS).toBe(1000);
  });
});
