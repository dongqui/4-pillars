"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  type StepKey,
  activeSteps,
  isValidStep,
  nextStep,
  prevStep,
  stepIndex,
} from "../_lib/steps";
import { useFunnel } from "../_context/FunnelContext";

export function useFunnelNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data } = useFunnel();
  const steps = activeSteps(data.timeKnown);

  const rawStep = searchParams.get("step");
  const step: StepKey = isValidStep(rawStep) ? rawStep : "name";

  const goTo = useCallback(
    (s: StepKey) => {
      router.push(`/funnel?step=${s}`);
    },
    [router]
  );

  const goNext = useCallback(() => {
    const n = nextStep(steps, step);
    if (n) router.push(`/funnel?step=${n}`);
  }, [router, steps, step]);

  const goBack = useCallback(() => {
    if (prevStep(steps, step)) router.back();
  }, [router, steps, step]);

  return {
    step,
    index: stepIndex(steps, step),
    total: steps.length,
    goTo,
    goNext,
    goBack,
    rawStep,
  };
}
