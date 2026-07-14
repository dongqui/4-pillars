import { describe, it, expect } from "vitest";
import { activeSteps, stepIndex, nextStep, prevStep, isValidStep } from "./steps";

describe("steps", () => {
  it("activeSteps는 timeKnown이면 birthplace를 포함한다", () => {
    expect(activeSteps(true)).toEqual([
      "name",
      "gender",
      "birth",
      "time",
      "birthplace",
      "review",
    ]);
  });

  it("activeSteps는 timeKnown이 아니면 birthplace를 제외한다", () => {
    expect(activeSteps(false)).toEqual(["name", "gender", "birth", "time", "review"]);
  });

  it("stepIndex는 주어진 목록 기준 인덱스를 반환한다", () => {
    const s = activeSteps(true);
    expect(stepIndex(s, "name")).toBe(0);
    expect(stepIndex(s, "birthplace")).toBe(4);
    expect(stepIndex(s, "review")).toBe(5);
  });

  it("nextStep은 timeKnown이면 time 다음이 birthplace", () => {
    const s = activeSteps(true);
    expect(nextStep(s, "time")).toBe("birthplace");
    expect(nextStep(s, "birthplace")).toBe("review");
    expect(nextStep(s, "review")).toBeNull();
  });

  it("nextStep은 timeKnown이 아니면 time 다음이 review", () => {
    const s = activeSteps(false);
    expect(nextStep(s, "time")).toBe("review");
  });

  it("prevStep은 birthplace 이전이 time, 처음은 null", () => {
    const s = activeSteps(true);
    expect(prevStep(s, "birthplace")).toBe("time");
    expect(prevStep(s, "name")).toBeNull();
  });

  it("isValidStep은 유효 키만 통과", () => {
    expect(isValidStep("birthplace")).toBe(true);
    expect(isValidStep("nope")).toBe(false);
    expect(isValidStep(null)).toBe(false);
  });
});
