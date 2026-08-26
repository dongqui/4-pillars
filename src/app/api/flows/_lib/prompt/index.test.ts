import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { FLOW_SECTION_KEYS } from "../sections";
import { flowSegments } from "../segments";
import { buildFlowContext } from "./facts";
import { buildFlowSectionRequest } from "./index";

const subject = analyze({
  year: 1990, month: 6, day: 15, hour: 10, minute: 30,
  gender: "male", calendar: "solar",
});
const segs = flowSegments(subject, 2026);
const ctx = buildFlowContext(subject, 2026, segs);

describe("buildFlowSectionRequest", () => {
  // registry.ts 의 prompt/example 문구에 연도·월·날짜가 슬쩍 섞여 들어가면
  // "시점을 지어내지 마라" 는 FLOW_SYSTEM_PROMPT 규칙을 예시 자체가 어기게 된다.
  // [사실] 블록만이 아니라 조립된 user 문자열 전체(요청 + 문체 예시 포함)를 검사해
  // 섹션 레지스트리를 고칠 때도 이 회귀를 잡는다.
  it.each(FLOW_SECTION_KEYS)("%s 섹션의 user 에는 날짜·연도가 없다", (key) => {
    const { user } = buildFlowSectionRequest(ctx, key);
    expect(user).not.toMatch(/\d{4}/);
    expect(user).not.toMatch(/\d{1,2}월/);
  });

  it("8개 섹션 전부를 검사한다", () => {
    expect(FLOW_SECTION_KEYS).toHaveLength(8);
  });
});
