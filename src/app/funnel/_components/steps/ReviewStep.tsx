"use client";

import { useFunnel } from "../../_context/FunnelContext";
import { formatCalendarLabel, formatTime } from "../../_lib/date";
import { getLocale } from "../../_lib/locale";
import { findRegion } from "@/lib/regions";
import { StepHeading } from "../StepHeading";

export function ReviewStep() {
  const { data } = useFunnel();

  const rows: { k: string; v: string }[] = [
    { k: "이름", v: data.name.trim() || "-" },
    {
      k: "성별",
      v:
        data.gender === "male"
          ? "남성"
          : data.gender === "female"
          ? "여성"
          : "-",
    },
    {
      k: "생년월일",
      v: formatCalendarLabel(data.calendar, data.isLeapMonth, data.birth),
    },
    {
      k: "태어난 시간",
      v: data.timeKnown
        ? data.time
          ? formatTime(data.time)
          : "-"
        : "시간 모름",
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
      <StepHeading
        title={
          <>
            입력 내용을
            <br className="md:hidden" /> 확인해주세요
          </>
        }
        sub="맞다면 분석을 시작할게요."
        gap="mb-6 md:mb-7"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 md:rounded-[18px]">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`flex items-center justify-between px-[18px] py-[15px] md:px-5 md:py-[17px] ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="text-[13px] text-slate-400 md:text-[13.5px]">{r.k}</span>
            <span className="text-[15px] font-semibold">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
