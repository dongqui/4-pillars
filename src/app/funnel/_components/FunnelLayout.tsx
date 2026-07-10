import { Stepper } from "./Stepper";
import { FunnelProgress } from "./FunnelProgress";

interface Props {
  index: number;
  total: number;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function FunnelLayout({ index, total, footer, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* 데스크톱 좌측 레일 */}
      <aside className="hidden md:flex flex-none w-[400px] bg-slate-50 border-r border-slate-200 px-11 py-11 flex-col">
        <div className="flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-slate-900 flex items-center justify-center text-white font-bold text-base">
            사
          </div>
          <span className="font-bold text-lg tracking-tight">사주</span>
        </div>
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
        <Stepper index={index} />
        <div className="mt-auto pt-8 flex items-center gap-2 text-[12.5px] text-slate-400">
          🔒 입력 정보는 안전하게 보관돼요
        </div>
      </aside>

      {/* 우측/모바일 본문 */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 md:px-14 pt-8">
          <FunnelProgress index={index} total={total} />
        </div>
        <div className="saju-scroll flex-1 overflow-y-auto flex items-center justify-center px-6 md:px-14 py-6">
          <div key={index} className="w-full max-w-[440px]">
            {children}
          </div>
        </div>
        <div className="px-6 md:px-14 py-6 md:border-t md:border-slate-100">
          {footer}
        </div>
      </main>
    </div>
  );
}
