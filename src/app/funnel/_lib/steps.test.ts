import { describe, it, expect } from "vitest";
import { STEPS, stepIndex, nextStep, prevStep, isValidStep } from "./steps";

describe("steps", () => {
  it("정의된 순서를 가진다", () => {
    expect(STEPS).toEqual(["name", "gender", "birth", "time", "review"]);
  });

  it("stepIndex는 0-based 인덱스를 반환한다", () => {
    expect(stepIndex("name")).toBe(0);
    expect(stepIndex("review")).toBe(4);
  });

  it("nextStep은 다음 스텝, 마지막은 null", () => {
    expect(nextStep("name")).toBe("gender");
    expect(nextStep("time")).toBe("review");
    expect(nextStep("review")).toBeNull();
  });

  it("prevStep은 이전 스텝, 처음은 null", () => {
    expect(prevStep("gender")).toBe("name");
    expect(prevStep("name")).toBeNull();
  });

  it("isValidStep은 유효 키만 통과", () => {
    expect(isValidStep("birth")).toBe(true);
    expect(isValidStep("nope")).toBe(false);
    expect(isValidStep(null)).toBe(false);
  });
});
