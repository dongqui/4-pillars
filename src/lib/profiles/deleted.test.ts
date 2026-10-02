import { describe, expect, it } from "vitest";
import { ProfileDeletedError, isProfileDeletedError } from "./deleted";

describe("isProfileDeletedError", () => {
  it("그 자체를 알아본다", () => {
    expect(isProfileDeletedError(new ProfileDeletedError())).toBe(true);
  });

  // produceFlowSections·produceMatchSections 는 생성기 예외를 *GenerationError 로 감싸
  // cause 에 넣는다. 페이지는 감싼 쪽을 받으므로 cause 까지 봐야 갈라낼 수 있다.
  it("cause 로 감싸여 와도 알아본다", () => {
    const wrapped = new Error("생성 실패", { cause: new ProfileDeletedError() });
    expect(isProfileDeletedError(wrapped)).toBe(true);
  });

  it("다른 오류는 아니다", () => {
    expect(isProfileDeletedError(new Error("x"))).toBe(false);
    expect(isProfileDeletedError(new Error("x", { cause: new Error("y") }))).toBe(false);
    expect(isProfileDeletedError("문자열")).toBe(false);
  });
});
