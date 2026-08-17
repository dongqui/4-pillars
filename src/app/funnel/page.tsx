"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelProvider, useFunnel, type FunnelData } from "./_context/FunnelContext";
import { useFunnelNav } from "./_hooks/useFunnelNav";
import { activeSteps, stepIndex, type StepKey } from "./_lib/steps";
import { FunnelLayout } from "./_components/FunnelLayout";
import { FunnelFooter } from "./_components/FunnelFooter";
import { CalculatingScreen } from "./_components/CalculatingScreen";
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
  if (data.timeKnown && data.time === null) return "time";
  return "review";
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

  // 입력 완료 → 프로필(또는 드래프트) 저장 후 리빌로.
  const submitted = useRef(false);
  useEffect(() => {
    // Strict Mode는 개발 모드에서 effect를 mount → cleanup → 재-mount로 두 번 실행한다.
    // cancelled 플래그는 언마운트 이후 router.push만 막을 뿐 fetch 자체를 막지 못해서,
    // 두 번째 실행도 그대로 POST를 보낸다 — AbortController로도 못 막는다(서버가 이미
    // 행을 커밋한 뒤에 abort 신호가 도착할 수 있다). ref는 컴포넌트 인스턴스에 붙어 있어
    // 재-mount에도 값이 살아남으므로, 두 번째 실행을 여기서 조기 종료시킨다.
    if (!analyzing || submitted.current) return;
    submitted.current = true;

    let cancelled = false;

    // 응답이 빨리 와도 계산 화면이 번쩍이지 않게 최소 노출 시간을 둔다. 리빌이 같은
    // 배경에서 한 번 더 문구를 보여주므로(합쳐서 2.2초) 여기서는 절반만 잡는다.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const minDelay = new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, 1100);
    });

    void (async () => {
      // 리빌은 서버에 남은 것(프로필 또는 드래프트)으로 캐릭터를 세운다. 저장이
      // 아예 실패하면 보여줄 것이 없으므로 홈으로 보내고, 홈이 빈 상태를 안내한다.
      let dest = "/home";
      try {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toProfileBody(data)),
        });
        if (res.status === 201) {
          const { id } = (await res.json()) as { id: string };
          dest = `/reveal?profile=${id}`;
        } else if (res.status === 202) {
          // 비로그인. 입력은 드래프트로 보관됐고 로그인하는 순간 프로필이 된다.
          dest = "/reveal";
        } else if (res.status === 409) {
          // 프로필 한도 초과 — 목록에서 정리하게 돌려보낸다.
          dest = "/home?error=limit";
        } else {
          // 저장이 조용히 사라지는 것이므로 최소한 로그로는 남긴다.
          console.error(`[POST /api/profiles] unexpected status ${res.status}`);
        }
      } catch {
        // 네트워크 오류 — dest 는 "/home" 그대로다.
      }
      await minDelay;
      if (!cancelled) router.push(dest);
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [analyzing, data, router]);

  if (analyzing) return <CalculatingScreen name={data.name} />;

  const canNext = (() => {
    switch (step) {
      case "name":
        return data.name.trim().length > 0;
      case "gender":
        return data.gender !== null;
      case "birth":
        return data.birth !== null;
      case "time":
        return !data.timeKnown || data.time !== null;
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
