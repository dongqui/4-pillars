"use client";

interface Props {
  name: string;
}

export function AnalyzingScreen({ name }: Props) {
  return (
    <div className="flex-1 min-h-screen flex flex-col items-center justify-center px-10">
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">
        사주를 계산하고 있어요
      </div>
      <div className="text-[15px] text-slate-500 mt-2">
        {name.trim() ? `${name.trim()}님, ` : ""}만세력 환산 · 오행 분석 중
      </div>
      <div className="mt-[34px] flex flex-col gap-3 w-full max-w-[260px]">
        <div className="flex items-center gap-2.5 text-sm text-slate-700">
          <span className="text-green-600">✓</span> 천간·지지 변환
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-700">
          <span className="text-green-600">✓</span> 오행 분포 집계
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <span className="text-accent">●</span> 십성·용신 분석
        </div>
      </div>
    </div>
  );
}
