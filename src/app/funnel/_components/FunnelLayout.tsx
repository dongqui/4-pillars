import { FunnelBrand } from "./FunnelBrand";
import { Stepper } from "./Stepper";
import { FunnelProgress } from "./FunnelProgress";
import { ProgressBar } from "@/components/ProgressBar";
import { type StepKey } from "../_lib/steps";

interface Props {
  index: number;
  steps: StepKey[];
  total: number;
  footer: React.ReactNode;
  children: React.ReactNode;
  onBack: () => void;
  showBack: boolean;
}

/**
 * 모바일(시안 "Saju Funnel mobile")은 뒤로가기 행 + 3px 진행선, 본문은 위에 붙고,
 * CTA 는 바닥에 고정된다. 데스크톱은 좌측 레일 + 가운데 정렬 본문(기존 데스크톱 시안).
 */
export function FunnelLayout({ index, steps, total, footer, children, onBack, showBack }: Props) {
  return (
    <div className="flex h-dvh flex-col md:min-h-screen md:h-auto md:flex-row">
      {/* 데스크톱 좌측 레일 */}
      <aside className="hidden md:flex flex-none w-[400px] bg-slate-50 border-r border-slate-200 px-11 py-11 flex-col">
        <FunnelBrand />
        <div className="mt-11">
          <div className="text-[13px] font-semibold text-accent mb-2.5">사주 정보 입력</div>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight">
            몇 가지만 알려주시면
            <br />
            사주를 분석해드려요
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mt-3.5">
            정확한 출생 정보일수록 더 깊이 있는 리포트를 받아보실 수 있어요.
          </p>
        </div>
        <Stepper index={index} steps={steps} />
        <div className="mt-auto pt-8 flex items-center gap-2 text-[12.5px] text-slate-400">
          🔒 입력 정보는 안전하게 보관돼요
        </div>
      </aside>

      {/* 우측/모바일 본문 */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 모바일 머리글: 뒤로가기 + 단계 표시 한 줄, 그 아래 얇은 진행선 */}
        <div className="flex-none px-6 pt-[max(8px,env(safe-area-inset-top))] md:hidden">
          <div className="-mx-2 flex h-11 items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              aria-label="이전"
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-[11px] border-0 bg-transparent p-0 text-slate-700 hover:bg-slate-50 ${
                showBack ? "visible" : "invisible"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="pr-2 text-[13px] font-semibold text-slate-400 tabular-nums">
              {index + 1}/{total}
            </span>
          </div>
          <div className="mt-0.5 flex">
            <ProgressBar value={index + 1} max={total} size="sm" />
          </div>
        </div>

        {/* 데스크톱 머리글: 진행선 + 단계 표시 */}
        <div className="hidden px-14 pt-8 md:block">
          <FunnelProgress index={index} total={total} />
        </div>

        <div className="saju-scroll flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-6 pb-4 pt-8 md:items-center md:px-14 md:py-6">
          <div key={index} className="saju-fade w-full max-w-[440px]">
            {children}
          </div>
        </div>

        {/* CTA: 모바일은 바닥 고정, 데스크톱은 구분선 위 */}
        <div className="flex-none bg-white px-6 pb-[max(30px,env(safe-area-inset-bottom))] pt-3 md:border-t md:border-slate-100 md:px-14 md:py-6">
          {footer}
        </div>
      </main>
    </div>
  );
}
