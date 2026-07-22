"use client";

import { Toggle } from "@/components/Toggle";
import { useFunnel } from "../../_context/FunnelContext";
import { formatCalendarLabel, formatTime } from "../../_lib/date";
import { getLocale } from "../../_lib/locale";
import { findRegion } from "../../_lib/regions";

export function ReviewStep() {
  const { data, update } = useFunnel();

  const rows: { k: string; v: string }[] = [
    { k: "이름", v: data.name.trim() || "-" },
    { k: "성별", v: data.gender === "male" ? "남성" : data.gender === "female" ? "여성" : "-" },
    {
      k: "생년월일",
      v: formatCalendarLabel(data.calendar, data.isLeapMonth, data.birth),
    },
    {
      k: "태어난 시간",
      v: data.timeKnown ? (data.time ? formatTime(data.time) : "-") : "시간 모름",
    },
  ];

  if (data.timeKnown) {
    const bp = data.birthPlace;
    let placeLabel = "출생지 모름";
    if (bp) {
      const r = findRegion(bp.country, bp.regionId);
      if (r) placeLabel = getLocale() === "ja" ? r.ja : r.ko;
    }
    rows.push({ k: "출생지", v: placeLabel });
  }

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        입력 내용을 확인해주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-7">맞다면 분석을 시작할게요.</p>

      <div className="border border-slate-200 rounded-[18px] overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`flex items-center justify-between px-5 py-[17px] ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="text-[13.5px] text-slate-400">{r.k}</span>
            <span className="text-[15px] font-semibold">{r.v}</span>
          </div>
        ))}
      </div>

      <div className="w-full flex items-center justify-between border border-slate-200 bg-slate-50 rounded-[15px] px-[18px] py-4 mt-4">
        <span>
          <span className="block text-sm font-semibold text-slate-700">진태양시 보정</span>
          <span className="block text-[12.5px] text-slate-400 mt-0.5">
            출생지 경도 기준 시간 보정
          </span>
        </span>
        <Toggle
          checked={data.trueSolar}
          onChange={(v) => update({ trueSolar: v })}
          label="진태양시 보정"
        />
      </div>
    </div>
  );
}
