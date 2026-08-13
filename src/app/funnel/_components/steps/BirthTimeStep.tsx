"use client";

import { useRef, useState } from "react";
import { useFunnel } from "../../_context/FunnelContext";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const inputCls =
  "w-[72px] rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-[17px] font-bold text-slate-900 text-center outline-none focus:border-accent placeholder:text-slate-300";

function parseTime(h: string, m: string): { h: number; m: number } | null {
  if (!h || !m) return null;
  const hh = parseInt(h, 10);
  const mm = parseInt(m, 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { h: hh, m: mm };
}

export function BirthTimeStep() {
  const { data, update } = useFunnel();
  const hourRef = useRef<HTMLInputElement>(null);
  const time = data.time;
  const [h, setH] = useState(time ? pad2(time.h) : "");
  const [m, setM] = useState(time ? pad2(time.m) : "");

  function digitsOnly(raw: string): string {
    return raw.replace(/\D/g, "").slice(0, 2);
  }

  function sync(nh: string, nm: string) {
    const parsed = parseTime(nh, nm);
    if (parsed) update({ time: parsed });
    else if (data.time) update({ time: null });
  }

  // 포커스가 벗어날 때 범위를 보정하고 컨텍스트에 반영
  function commit() {
    if (!h && !m) return;
    if (!h) return;
    const hh = clamp(parseInt(h, 10) || 0, 0, 23);
    const mm = clamp(parseInt(m, 10) || 0, 0, 59);
    setH(pad2(hh));
    setM(pad2(mm));
    update({ time: { h: hh, m: mm } });
  }

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        태어난 시간을 알려주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">시(時) 기둥 계산에 사용돼요.</p>

      {/* 비활성 상태에서 클릭하면 토글을 풀고 다시 입력할 수 있게 한다 */}
      <div
        onClick={() => {
          if (!data.timeKnown) {
            update({ timeKnown: true });
            requestAnimationFrame(() => hourRef.current?.focus());
          }
        }}
        className={data.timeKnown ? "" : "cursor-pointer"}
      >
        <div
          className={`flex items-center gap-2 transition-opacity ${
            data.timeKnown ? "" : "opacity-40 pointer-events-none"
          }`}
        >
          <input
            ref={hourRef}
            value={h}
            onChange={(e) => {
              const v = digitsOnly(e.target.value);
              setH(v);
              sync(v, m);
            }}
            onBlur={commit}
            inputMode="numeric"
            placeholder="12"
            aria-label="시"
            className={inputCls}
          />
          <span className="text-slate-400">시</span>
          <input
            value={m}
            onChange={(e) => {
              const v = digitsOnly(e.target.value);
              setM(v);
              sync(h, v);
            }}
            onBlur={commit}
            inputMode="numeric"
            placeholder="00"
            aria-label="분"
            className={inputCls}
          />
          <span className="text-slate-400">분</span>
        </div>
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
