import { describe, expect, it } from "vitest";
import { FLOW_SECTION_KEYS, flowLlmInputSchema, parseFlowSectionContent } from "./derive";

const seg = (id: string, i: number) => ({
  segmentId: id,
  title: `제목${i}`,
  body: `본문${i}`,
});

describe("parseFlowSectionContent", () => {
  it("구간 수가 맞으면 통과한다", () => {
    const out = parseFlowSectionContent(
      "now",
      { common: "배경", segments: [seg("segment_1", 1), seg("segment_2", 2)] },
      2,
    );
    expect(out?.segments).toHaveLength(2);
  });

  it("구간 수가 모자라면 null — 조용히 어긋나게 두지 않는다", () => {
    expect(
      parseFlowSectionContent("now", { common: "배경", segments: [seg("segment_1", 1)] }, 2),
    ).toBeNull();
  });

  it("계산된 구간 수 밖의 id 는 enum 이 막는다", () => {
    expect(
      parseFlowSectionContent(
        "now",
        { common: "배경", segments: [seg("segment_1", 1), seg("segment_3", 3)] },
        2,
      ),
    ).toBeNull();
  });

  it("id 가 중복되면 null — 개수만 맞고 한 칸이 비는 응답을 막는다", () => {
    expect(
      parseFlowSectionContent(
        "now",
        { common: "배경", segments: [seg("segment_1", 1), seg("segment_1", 1)] },
        2,
      ),
    ).toBeNull();
  });

  it("07(ahead)에는 common 이 없다 — 타임라인 그 자체다", () => {
    const out = parseFlowSectionContent("ahead", { segments: [seg("segment_1", 1)] }, 1);
    expect(out).not.toBeNull();
    expect(out as object).not.toHaveProperty("common");
  });

  it("01~06·08 에 common 이 없으면 null", () => {
    expect(parseFlowSectionContent("now", { segments: [seg("segment_1", 1)] }, 1)).toBeNull();
  });

  it("빈 문자열은 통과하지 못한다", () => {
    expect(
      parseFlowSectionContent("now", { common: "", segments: [seg("segment_1", 1)] }, 1),
    ).toBeNull();
  });

  it("모르는 키는 좁혀지지 않는다", () => {
    expect(FLOW_SECTION_KEYS).toHaveLength(8);
  });
});

describe("flowLlmInputSchema", () => {
  it("최상위를 content 로 한 겹 감싼다 — 리포트·궁합과 같은 계약", () => {
    const schema = flowLlmInputSchema("now", 2);
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("content");
  });

  it("구간 수가 스키마에 박힌다 — LLM 이 개수를 못 바꾼다", () => {
    const two = JSON.stringify(flowLlmInputSchema("now", 2));
    const three = JSON.stringify(flowLlmInputSchema("now", 3));
    expect(two).not.toBe(three);
    expect(two).toContain("segment_2");
    expect(two).not.toContain("segment_3");
  });
});
