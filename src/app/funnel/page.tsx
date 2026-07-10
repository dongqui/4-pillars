"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelProvider, useFunnel, type FunnelData } from "./_context/FunnelContext";
import { useFunnelNav } from "./_hooks/useFunnelNav";
import { stepIndex, type StepKey } from "./_lib/steps";
import { FunnelLayout } from "./_components/FunnelLayout";
import { FunnelFooter } from "./_components/FunnelFooter";
import { AnalyzingScreen } from "./_components/AnalyzingScreen";
import { NameStep } from "./_components/steps/NameStep";
import { GenderStep } from "./_components/steps/GenderStep";
import { BirthDateStep } from "./_components/steps/BirthDateStep";
import { BirthTimeStep } from "./_components/steps/BirthTimeStep";
import { ReviewStep } from "./_components/steps/ReviewStep";

function earliestAllowedStep(data: FunnelData): StepKey {
  if (!data.name.trim()) return "name";
  if (data.gender === null) return "gender";
  if (data.birth === null) return "birth";
  return "review"; // time has a default / can be skipped; everything required is present
}

function FunnelInner() {
  const router = useRouter();
  const { data } = useFunnel();
  const { step, index, total, goNext, goBack } = useFunnelNav();
  const [analyzing, setAnalyzing] = useState(false);

  // 가드: 현재 스텝이 데이터상 허용된 스텝보다 앞서 있으면(수동 URL 이동 등) 되돌린다
  useEffect(() => {
    const allowed = earliestAllowedStep(data);
    if (stepIndex(step) > stepIndex(allowed)) {
      router.replace(`/funnel?step=${allowed}`);
    }
  }, [step, data, router]);

  // 분석 완료 → 리포트 stub
  useEffect(() => {
    if (!analyzing) return;
    const t = setTimeout(() => router.push("/report"), 2200);
    return () => clearTimeout(t);
  }, [analyzing, router]);

  if (analyzing) return <AnalyzingScreen name={data.name} />;

  const canNext = (() => {
    switch (step) {
      case "name":
        return data.name.trim().length > 0;
      case "gender":
        return data.gender !== null;
      default:
        return true;
    }
  })();

  const isLast = step === "review";

  function handleNext() {
    if (!canNext) return;
    if (isLast) {
      const allowed = earliestAllowedStep(data);
      if (allowed !== "review") {
        router.replace(`/funnel?step=${allowed}`);
        return;
      }
      setAnalyzing(true);
      return;
    }
    goNext();
  }

  const stepEl = {
    name: <NameStep />,
    gender: <GenderStep />,
    birth: <BirthDateStep />,
    time: <BirthTimeStep />,
    review: <ReviewStep />,
  }[step];

  return (
    <FunnelLayout
      index={index}
      total={total}
      onBack={goBack}
      showBack={index > 0}
      footer={
        <FunnelFooter
          canNext={canNext}
          isLast={isLast}
          showBack={index > 0}
          onNext={handleNext}
          onBack={goBack}
        />
      }
    >
      {stepEl}
    </FunnelLayout>
  );
}

export default function FunnelPage() {
  return (
    <Suspense fallback={null}>
      <FunnelProvider>
        <FunnelInner />
      </FunnelProvider>
    </Suspense>
  );
}
