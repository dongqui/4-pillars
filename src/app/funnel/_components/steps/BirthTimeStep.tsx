"use client";

import { useEffect } from "react";
import { TimeWheelPicker } from "@/components/TimeWheelPicker";
import { useFunnel } from "../../_context/FunnelContext";

export function BirthTimeStep() {
  const { data, update } = useFunnel();

  useEffect(() => {
    if (data.timeKnown && !data.time) update({ time: { h: 12, m: 0 } });
  }, [data.timeKnown, data.time, update]);

  const time = data.time ?? { h: 12, m: 0 };

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        태어난 시간을 알려주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">시(時) 기둥 계산에 사용돼요.</p>

      <div
        className={`transition-opacity ${data.timeKnown ? "" : "opacity-40 pointer-events-none"}`}
      >
        <TimeWheelPicker value={time} onChange={(v) => update({ time: v })} />
      </div>

      <button
        type="button"
        onClick={() => update({ timeKnown: !data.timeKnown })}
        aria-pressed={!data.timeKnown}
        className={`w-full flex items-center gap-2.5 mt-4 text-sm font-semibold rounded-xl px-[18px] py-4 transition-all cursor-pointer border ${
          data.timeKnown
            ? "border-slate-200 bg-white text-slate-500"
            : "border-2 border-accent bg-accent-50 text-accent"
        }`}
      >
        <span className="text-base">{data.timeKnown ? "○" : "●"}</span>
        태어난 시간을 몰라요
      </button>
    </div>
  );
}
