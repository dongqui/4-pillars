"use client";

import { useMemo } from "react";
import { WheelPicker, type WheelItem } from "./WheelPicker";

interface TimeValue {
  h: number;
  m: number;
}

interface Props {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function range(start: number, end: number): WheelItem[] {
  const out: WheelItem[] = [];
  for (let i = start; i <= end; i++) out.push({ value: i, label: pad2(i) });
  return out;
}

export function TimeWheelPicker({ value, onChange }: Props) {
  const hours = useMemo(() => range(0, 23), []);
  const minutes = useMemo(() => range(0, 59), []);

  return (
    <div className="flex items-center justify-center gap-2">
      <WheelPicker
        items={hours}
        value={value.h}
        onChange={(h) => onChange({ h, m: value.m })}
        width={64}
      />
      <span className="text-slate-400 text-xl font-bold">:</span>
      <WheelPicker
        items={minutes}
        value={value.m}
        onChange={(m) => onChange({ h: value.h, m })}
        width={64}
      />
    </div>
  );
}
