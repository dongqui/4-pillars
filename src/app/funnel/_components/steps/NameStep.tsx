"use client";

import { useFunnel } from "../../_context/FunnelContext";

export function NameStep() {
  const { data, update } = useFunnel();
  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        이름을 알려주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-10">리포트에 표시할 이름이에요.</p>
      <input
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="이름"
        autoFocus
        className="w-full border-0 border-b-2 border-slate-200 focus:border-accent outline-none py-2.5 px-0.5 text-[30px] font-bold text-slate-900 placeholder:text-slate-300"
      />
    </div>
  );
}
