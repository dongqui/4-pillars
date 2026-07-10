"use client";

import { OptionCard } from "@/components/OptionCard";
import { useFunnel } from "../../_context/FunnelContext";

export function GenderStep() {
  const { data, update } = useFunnel();
  const name = data.name.trim() || "회원";
  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        {name}님의 성별은?
      </h1>
      <p className="text-[15px] text-slate-500 mb-9">양·음 기운 해석에 사용돼요.</p>
      <div className="flex gap-3.5">
        <OptionCard
          selected={data.gender === "male"}
          onClick={() => update({ gender: "male" })}
          className="flex-1 text-center text-[17px] px-5 py-[34px]"
        >
          <div className="text-[30px] mb-2.5">♂</div>
          남성
        </OptionCard>
        <OptionCard
          selected={data.gender === "female"}
          onClick={() => update({ gender: "female" })}
          className="flex-1 text-center text-[17px] px-5 py-[34px]"
        >
          <div className="text-[30px] mb-2.5">♀</div>
          여성
        </OptionCard>
      </div>
    </div>
  );
}
