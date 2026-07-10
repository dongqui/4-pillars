export type StepKey = "name" | "gender" | "birth" | "time" | "review";

export const STEPS: StepKey[] = ["name", "gender", "birth", "time", "review"];

export function stepIndex(step: StepKey): number {
  return STEPS.indexOf(step);
}

export function nextStep(step: StepKey): StepKey | null {
  const i = stepIndex(step);
  return i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

export function prevStep(step: StepKey): StepKey | null {
  const i = stepIndex(step);
  return i > 0 ? STEPS[i - 1] : null;
}

export function isValidStep(v: string | null): v is StepKey {
  return v !== null && (STEPS as string[]).includes(v);
}
