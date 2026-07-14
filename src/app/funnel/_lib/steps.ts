export type StepKey = "name" | "gender" | "birth" | "time" | "birthplace" | "review";

export const ALL_STEPS: StepKey[] = [
  "name",
  "gender",
  "birth",
  "time",
  "birthplace",
  "review",
];

/** timeKnown일 때만 birthplace를 포함한 활성 스텝 목록 */
export function activeSteps(timeKnown: boolean): StepKey[] {
  return timeKnown
    ? ["name", "gender", "birth", "time", "birthplace", "review"]
    : ["name", "gender", "birth", "time", "review"];
}

export function stepIndex(steps: StepKey[], step: StepKey): number {
  return steps.indexOf(step);
}

export function nextStep(steps: StepKey[], step: StepKey): StepKey | null {
  const i = steps.indexOf(step);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export function prevStep(steps: StepKey[], step: StepKey): StepKey | null {
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1] : null;
}

export function isValidStep(v: string | null): v is StepKey {
  return v !== null && (ALL_STEPS as string[]).includes(v);
}
