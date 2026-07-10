"use client";

import { useMemo } from "react";
import { WheelPicker, type WheelItem } from "./WheelPicker";

interface DateValue {
  y: number;
  m: number;
  d: number;
}

interface Props {
  value: DateValue;
  onChange: (v: DateValue) => void;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // m: 1..12
}

const CURRENT_YEAR = new Date().getFullYear();

export function DateWheelPicker({ value, onChange }: Props) {
  const years: WheelItem[] = useMemo(
    () =>
      range(1930, CURRENT_YEAR).map((y) => ({
        value: y,
        label: `${y}`,
      })),
    []
  );
  const months: WheelItem[] = useMemo(
    () =>
      range(1, 12).map((m) => ({
        value: m,
        label: `${m}`,
      })),
    []
  );
  const days: WheelItem[] = useMemo(
    () =>
      range(1, daysInMonth(value.y, value.m)).map((d) => ({
        value: d,
        label: `${d}`,
      })),
    [value.y, value.m]
  );

  function clampDay(y: number, m: number, d: number): number {
    return Math.min(d, daysInMonth(y, m));
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <WheelPicker
        items={years}
        value={value.y}
        onChange={(y) => onChange({ y, m: value.m, d: clampDay(y, value.m, value.d) })}
        width={84}
      />
      <span className="text-slate-400">년</span>
      <WheelPicker
        items={months}
        value={value.m}
        onChange={(m) => onChange({ y: value.y, m, d: clampDay(value.y, m, value.d) })}
        width={56}
      />
      <span className="text-slate-400">월</span>
      <WheelPicker
        items={days}
        value={value.d}
        onChange={(d) => onChange({ y: value.y, m: value.m, d })}
        width={56}
      />
      <span className="text-slate-400">일</span>
    </div>
  );
}
