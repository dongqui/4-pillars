import { describe, it, expect } from "vitest";
import { KeyValue, LabeledText, TimelineNote, TitledText } from "./primitives";

describe("primitives", () => {
  it("TitledText 는 title/body 를 요구한다", () => {
    expect(TitledText.safeParse({ title: "제목", body: "본문" }).success).toBe(true);
    expect(TitledText.safeParse({ title: "제목" }).success).toBe(false);
  });

  it("빈 문자열을 거부한다 (LLM 이 필드만 채우고 내용을 비우는 것 방지)", () => {
    expect(TitledText.safeParse({ title: "", body: "본문" }).success).toBe(false);
  });

  it("모르는 필드를 거부한다 (strict)", () => {
    expect(TitledText.safeParse({ title: "제목", body: "본문", extra: 1 }).success).toBe(false);
  });

  it("LabeledText / KeyValue / TimelineNote 도 같은 규칙", () => {
    expect(LabeledText.safeParse({ label: "라벨", body: "본문" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", value: "값" }).success).toBe(true);
    expect(TimelineNote.safeParse({ title: "제목", desc: "설명" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", body: "본문" }).success).toBe(false);
  });
});
