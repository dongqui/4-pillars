"use client";

import { useEffect, useRef } from "react";

export interface WheelItem {
  value: number;
  label: string;
}

interface Props {
  items: WheelItem[];
  value: number;
  onChange: (v: number) => void;
  width?: number;
}

const ITEM_H = 36;
const VISIBLE = 5; // 홀수, 가운데가 선택

export function WheelPicker({ items, value, onChange, width = 72 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pad = (VISIBLE - 1) / 2;

  // value가 바뀌면 해당 위치로 스크롤 정렬
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.findIndex((it) => it.value === value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [value, items]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped];
      if (next && next.value !== value) onChange(next.value);
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 120);
  }

  return (
    <div className="relative" style={{ width, height: ITEM_H * VISIBLE }}>
      {/* 중앙 선택 밴드 */}
      <div
        className="pointer-events-none absolute inset-x-0 border-y border-slate-200"
        style={{ top: pad * ITEM_H, height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="saju-scroll h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollPaddingTop: pad * ITEM_H }}
      >
        <div style={{ height: pad * ITEM_H }} />
        {items.map((it) => (
          <div
            key={it.value}
            className={`snap-center flex items-center justify-center text-[17px] ${
              it.value === value
                ? "text-slate-900 font-bold"
                : "text-slate-400"
            }`}
            style={{ height: ITEM_H }}
          >
            {it.label}
          </div>
        ))}
        <div style={{ height: pad * ITEM_H }} />
      </div>
    </div>
  );
}
