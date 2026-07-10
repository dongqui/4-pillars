"use client";

import { Button } from "@/components/Button";

interface Props {
  canNext: boolean;
  isLast: boolean;
  showBack: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function FunnelFooter({ canNext, isLast, showBack, onNext, onBack }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onBack}
        className={`text-[15px] font-semibold text-slate-500 hover:text-slate-900 py-3 px-1 cursor-pointer ${
          showBack ? "visible" : "invisible"
        }`}
      >
        ← 이전
      </button>
      <Button onClick={onNext} disabled={!canNext} className="px-10 py-4 text-base">
        {isLast ? "사주 분석 시작" : "다음"}
      </Button>
    </div>
  );
}
