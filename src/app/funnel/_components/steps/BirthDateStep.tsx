"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useFunnel, type Calendar } from "../../_context/FunnelContext";
import { hasLeapMonth } from "@/lib/saju-core";
import { Toggle } from "@/components/Toggle";

const CURRENT_YEAR = new Date().getFullYear();

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // m: 1..12
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-[17px] font-bold text-slate-900 text-center outline-none focus:border-accent placeholder:text-slate-300";

export function BirthDateStep() {
  const { data, update } = useFunnel();

  useEffect(() => {
    if (!data.birth) update({ birth: { y: 1990, m: 1, d: 1 } });
  }, [data.birth, update]);

  const birth = data.birth ?? { y: 1990, m: 1, d: 1 };
  const [y, setY] = useState(String(birth.y));
  const [m, setM] = useState(String(birth.m));
  const [d, setD] = useState(String(birth.d));

  function digitsOnly(raw: string, maxLen: number): string {
    return raw.replace(/\D/g, "").slice(0, maxLen);
  }

  // 포커스가 벗어날 때 범위를 보정하고 컨텍스트에 반영
  function commit() {
    const yy = clamp(parseInt(y, 10) || 1990, 1930, CURRENT_YEAR);
    const mm = clamp(parseInt(m, 10) || 1, 1, 12);
    const dd = clamp(parseInt(d, 10) || 1, 1, daysInMonth(yy, mm));
    setY(String(yy));
    setM(String(mm));
    setD(String(dd));
    const patch: Partial<typeof data> = { birth: { y: yy, m: mm, d: dd } };
    if (data.calendar === "lunar" && !hasLeapMonth(yy, mm) && data.isLeapMonth) {
      patch.isLeapMonth = false;
    }
    update(patch);
  }

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
        onChange={(calendar) =>
          update({ calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
        }
        className="max-w-[240px] mb-6"
      />
      <div className="flex items-center gap-2">
        <input
          value={y}
          onChange={(e) => setY(digitsOnly(e.target.value, 4))}
          onBlur={commit}
          inputMode="numeric"
          placeholder="1990"
          aria-label="년"
          autoFocus
          className={`w-[92px] ${inputCls}`}
        />
        <span className="text-slate-400">년</span>
        <input
          value={m}
          onChange={(e) => setM(digitsOnly(e.target.value, 2))}
          onBlur={commit}
          inputMode="numeric"
          placeholder="1"
          aria-label="월"
          className={`w-[64px] ${inputCls}`}
        />
        <span className="text-slate-400">월</span>
        <input
          value={d}
          onChange={(e) => setD(digitsOnly(e.target.value, 2))}
          onBlur={commit}
          inputMode="numeric"
          placeholder="1"
          aria-label="일"
          className={`w-[64px] ${inputCls}`}
        />
        <span className="text-slate-400">일</span>
      </div>
      {data.calendar === "lunar" && hasLeapMonth(birth.y, birth.m) && (
        <div className="mt-5 flex items-center justify-between rounded-[15px] border border-slate-200 bg-slate-50 px-[18px] py-4">
          <span>
            <span className="block text-sm font-semibold text-slate-700">윤달</span>
            <span className="mt-0.5 block text-[12.5px] text-slate-400">
              {birth.m}월에 윤달로 태어났다면 켜주세요
            </span>
          </span>
          <Toggle
            checked={data.isLeapMonth}
            onChange={(v) => update({ isLeapMonth: v })}
            label="윤달"
          />
        </div>
      )}
    </div>
  );
}
