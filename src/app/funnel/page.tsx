"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelProvider, useFunnel, type FunnelData } from "./_context/FunnelContext";
import { useFunnelNav } from "./_hooks/useFunnelNav";
import { activeSteps, stepIndex, type StepKey } from "./_lib/steps";
import { FunnelLayout } from "./_components/FunnelLayout";
import { FunnelFooter } from "./_components/FunnelFooter";
import { AnalyzingScreen } from "./_components/AnalyzingScreen";
import { toProfileBody } from "./_lib/toProfileBody";
import { NameStep } from "./_components/steps/NameStep";
import { GenderStep } from "./_components/steps/GenderStep";
import { BirthDateStep } from "./_components/steps/BirthDateStep";
import { BirthTimeStep } from "./_components/steps/BirthTimeStep";
import { BirthPlaceStep } from "./_components/steps/BirthPlaceStep";
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
  const { step, steps, index, total, goNext, goBack } = useFunnelNav();
  const [analyzing, setAnalyzing] = useState(false);

  // 가드: 현재 스텝이 활성 목록에 없거나 허용 스텝보다 앞서면(수동 URL 이동 등) 되돌린다
  useEffect(() => {
    const steps = activeSteps(data.timeKnown);
    const allowed = earliestAllowedStep(data);
    const stepIdx = stepIndex(steps, step);
    if (stepIdx === -1 || stepIdx > stepIndex(steps, allowed)) {
      router.replace(`/funnel?step=${allowed}`);
    }
  }, [step, data, router]);

  // 분석 완료 → 프로필 저장 후 리포트로.
  // 저장에 실패해도 사용자를 막지 않는다 — 리포트는 입력만으로 볼 수 있다.
  useEffect(() => {
    if (!analyzing) return;
    let cancelled = false;

    // 응답이 빨리 와도 분석 화면이 번쩍이지 않게 최소 노출 시간을 둔다.
    const minDelay = new Promise((r) => setTimeout(r, 2200));

    void (async () => {
      let dest = "/report";
      try {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toProfileBody(data)),
        });
        if (res.status === 201) {
          const { id } = (await res.json()) as { id: string };
          dest = `/report?profile=${id}`;
        } else if (res.status === 409) {
          // 프로필 한도 초과 — 목록에서 정리하게 돌려보낸다.
          dest = "/home";
        }
        // 401(비로그인)과 그 밖의 오류는 저장 없이 리포트만 보여준다.
      } catch {
        // 네트워크 오류도 마찬가지.
      }
      await minDelay;
      if (!cancelled) router.push(dest);
    })();

    return () => {
      cancelled = true;
    };
  }, [analyzing, data, router]);

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
    birthplace: <BirthPlaceStep />,
    review: <ReviewStep />,
  }[step];

  return (
    <FunnelLayout
      index={index}
      steps={steps}
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
