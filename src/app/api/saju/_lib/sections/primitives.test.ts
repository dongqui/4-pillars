import { describe, it, expect } from "vitest";
import { KeyValue, LabeledText, ShortTitledText, TitledText, TraitNote } from "./primitives";

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

  it("LabeledText / KeyValue 도 같은 규칙", () => {
    expect(LabeledText.safeParse({ label: "라벨", body: "본문" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", value: "값" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", body: "본문" }).success).toBe(false);
  });

  // basis 는 사주 근거가 들어가는 유일한 필드다. 이게 옵셔널이면 LLM 이
  // 그냥 빼먹고, 카드가 "왜 그런지" 없이 단정만 남는다.
  it("TraitNote 는 title/body/basis 를 모두 요구한다", () => {
    const ok = { title: "신중한 관찰자", body: "본문", basis: "근거" };
    expect(TraitNote.safeParse(ok).success).toBe(true);
    expect(TraitNote.safeParse({ title: "제목", body: "본문" }).success).toBe(false);
    expect(TraitNote.safeParse({ ...ok, basis: "" }).success).toBe(false);
    expect(TraitNote.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  // title 은 히어로의 rounded-full 칩으로도 그대로 렌더된다 — 문장형 제목이면
  // 칩이 줄바꿈 레이아웃을 깨뜨린다. 20자를 상한으로 못박는다.
  it("TraitNote 의 title 은 20자를 넘기지 못한다", () => {
    const base = { body: "본문", basis: "근거" };
    const twenty = "가".repeat(20);
    const twentyOne = "가".repeat(21);
    expect(TraitNote.safeParse({ ...base, title: twenty }).success).toBe(true);
    expect(TraitNote.safeParse({ ...base, title: twentyOne }).success).toBe(false);
  });

  // 두 스키마가 갈라져 있는 이유 자체를 고정한다 — 03 강점의 서술형 제목은
  // 통과해야 하고, 같은 제목이 13 카드에는 들어오면 안 된다.
  it("ShortTitledText 만 제목 길이를 막는다", () => {
    const long = { title: "회의가 산으로 갈 때 결정할 것을 정리하는 쪽이에요", body: "본문" };
    expect(TitledText.safeParse(long).success).toBe(true);
    expect(ShortTitledText.safeParse(long).success).toBe(false);
    expect(ShortTitledText.safeParse({ title: "가".repeat(20), body: "본문" }).success).toBe(true);
    expect(ShortTitledText.safeParse({ title: "", body: "본문" }).success).toBe(false);
    expect(ShortTitledText.safeParse({ title: "제목", body: "본문", extra: 1 }).success).toBe(false);
  });
});
