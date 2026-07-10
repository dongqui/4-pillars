"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelProvider, useFunnel } from "./_context/FunnelContext";
import { useFunnelNav } from "./_hooks/useFunnelNav";
import { FunnelLayout } from "./_components/FunnelLayout";
import { FunnelFooter } from "./_components/FunnelFooter";
import { AnalyzingScreen } from "./_components/AnalyzingScreen";
import { NameStep } from "./_components/steps/NameStep";
import { GenderStep } from "./_components/steps/GenderStep";
import { BirthDateStep } from "./_components/steps/BirthDateStep";
import { BirthTimeStep } from "./_components/steps/BirthTimeStep";
import { ReviewStep } from "./_components/steps/ReviewStep";

function FunnelInner() {
  const router = useRouter();
  const { data } = useFunnel();
  const { step, index, total, goNext, goBack } = useFunnelNav();
  const [analyzing, setAnalyzing] = useState(false);

  // 가드: Context가 비었는데(name 공백) 첫 스텝이 아니면 첫 스텝으로
  useEffect(() => {
    if (step !== "name" && !data.name.trim()) {
      router.replace("/funnel?step=name");
    }
  }, [step, data.name, router]);

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
    if (isLast) setAnalyzing(true);
    else goNext();
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
