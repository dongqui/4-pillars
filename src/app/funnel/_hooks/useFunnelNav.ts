"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  STEPS,
  type StepKey,
  isValidStep,
  nextStep,
  prevStep,
  stepIndex,
} from "../_lib/steps";

export function useFunnelNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  const step: StepKey = isValidStep(rawStep) ? rawStep : "name";

  const goTo = useCallback(
    (s: StepKey) => {
      router.push(`/funnel?step=${s}`);
    },
    [router]
  );

  const goNext = useCallback(() => {
    const n = nextStep(step);
    if (n) router.push(`/funnel?step=${n}`);
  }, [router, step]);

  const goBack = useCallback(() => {
    if (prevStep(step)) router.back();
  }, [router, step]);

  return {
    step,
    index: stepIndex(step),
    total: STEPS.length,
    goTo,
    goNext,
    goBack,
    rawStep,
  };
}
