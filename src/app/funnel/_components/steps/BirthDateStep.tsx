"use client";

import { useEffect } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DateWheelPicker } from "@/components/DateWheelPicker";
import { useFunnel, type Calendar } from "../../_context/FunnelContext";

export function BirthDateStep() {
  const { data, update } = useFunnel();

  useEffect(() => {
    if (!data.birth) update({ birth: { y: 1990, m: 1, d: 1 } });
  }, [data.birth, update]);

  const birth = data.birth ?? { y: 1990, m: 1, d: 1 };

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        생년월일을 입력해주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">달력 종류를 먼저 선택해주세요.</p>
      <SegmentedControl<Calendar>
        options={[
          { value: "solar", label: "양력" },
          { value: "lunar", label: "음력" },
        ]}
        value={data.calendar}
        onChange={(calendar) => update({ calendar })}
        className="max-w-[240px] mb-6"
      />
      <DateWheelPicker value={birth} onChange={(v) => update({ birth: v })} />
    </div>
  );
}
