"use client";

import { useEffect, useRef } from "react";
import {
  WHEEL_ITEM_HEIGHT,
  WHEEL_PAD,
  WHEEL_VISIBLE_ROWS,
  indexFromScroll,
  scrollForIndex,
} from "./model";

export interface WheelColumnSpec {
  id: string;
  values: number[];
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  /** 접근성 이름("년", "시" 등). */
  label: string;
}

interface Props {
  columns: WheelColumnSpec[];
}

/** 스크롤이 멈춘 뒤 선택을 확정하기까지의 여유. 스냅이 자리를 잡을 시간이다. */
const SETTLE_MS = 130;

/**
 * iOS 식 휠 피커(시안 "WHEEL PICKER SHEET"). 열마다 scroll-snap 으로 44px 칸에
 * 붙고, 가운데 띠에 놓인 칸이 값이다. 스크롤이 멈추면 값을 올리고, 칸을 누르면
 * 그 칸으로 굴린다.
 */
export function WheelPicker({ columns }: Props) {
  const height = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
  return (
    <div className="relative">
      {/* 선택 띠 — 열 뒤에 깔린다 */}
      <div
        aria-hidden
        className="absolute inset-x-0 rounded-xl bg-slate-100"
        style={{ top: WHEEL_PAD, height: WHEEL_ITEM_HEIGHT }}
      />
      <div className="relative flex gap-1.5" style={{ height }}>
        {columns.map((col) => (
          <WheelColumn key={col.id} {...col} />
        ))}
      </div>
      {/* 위아래 페이드 — 클릭은 통과시킨다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70px] bg-gradient-to-b from-white to-white/0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px] bg-gradient-to-t from-white to-white/0"
      />
    </div>
  );
}

function WheelColumn({ values, value, format, onChange, label }: WheelColumnSpec) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const index = Math.max(0, values.indexOf(value));

  // 마운트 직후 선택 칸으로 맞춘다. 값이 바깥에서 바뀌면(월을 바꿔 일이 줄어든 경우)
  // 그때도 따라간다 — 사용자가 굴리는 중에는 스크롤이 이미 그 칸이라 건드리지 않는다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (indexFromScroll(el.scrollTop, values.length) !== index) {
      el.scrollTop = scrollForIndex(index);
    }
  }, [index, values.length]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = indexFromScroll(el.scrollTop, values.length);
      if (values[i] !== value) onChange(values[i]);
    }, SETTLE_MS);
  }

  function pick(v: number, i: number) {
    onChange(v);
    ref.current?.scrollTo({ top: scrollForIndex(i), behavior: "smooth" });
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role="listbox"
      aria-label={label}
      className="saju-scroll relative flex-1 overflow-y-auto snap-y snap-mandatory outline-none"
      style={{ scrollPaddingTop: WHEEL_PAD }}
    >
      <div style={{ height: WHEEL_PAD }} />
      {values.map((v, i) => {
        const on = v === value;
        return (
          <div
            key={v}
            role="option"
            aria-selected={on}
            onClick={() => pick(v, i)}
            className={`flex cursor-pointer snap-start items-center justify-center tabular-nums transition-colors ${
              on ? "text-[19px] font-bold text-slate-900" : "text-[17px] font-medium text-[#B6BDC7]"
            }`}
            style={{ height: WHEEL_ITEM_HEIGHT }}
          >
            {format(v)}
          </div>
        );
      })}
      <div style={{ height: WHEEL_PAD }} />
    </div>
  );
}
