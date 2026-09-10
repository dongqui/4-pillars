"use client";

import { useFunnel } from "../../_context/FunnelContext";
import { StepHeading } from "../StepHeading";

export function NameStep() {
  const { data, update } = useFunnel();
  return (
    <div>
      <StepHeading title="이름을 알려주세요" sub="리포트에 표시할 이름이에요." gap="mb-9 md:mb-10" />
      <input
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="이름"
        aria-label="이름"
        maxLength={20}
        autoFocus
        className="w-full border-0 border-b-2 border-slate-200 focus:border-accent outline-none py-2 md:py-2.5 px-0.5 text-[26px] md:text-[30px] font-bold text-slate-900 placeholder:text-slate-300"
      />
    </div>
  );
}
