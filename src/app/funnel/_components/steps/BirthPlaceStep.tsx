"use client";

import { useEffect, useMemo, useState } from "react";
import { useFunnel } from "../../_context/FunnelContext";
import { getLocale, localeToCountry } from "../../_lib/locale";
import { getRegions, DEFAULT_REGION_ID, type Region } from "@/lib/regions";
import { StepHeading } from "../StepHeading";

export function BirthPlaceStep() {
  const { data, update } = useFunnel();
  const locale = getLocale();
  const country = localeToCountry(locale);
  const regions = useMemo(() => getRegions(country), [country]);
  const [q, setQ] = useState("");

  // 진입 시 기본 지역(서울/도쿄) 프리셋. 스킵하면 null로 되돌린다.
  useEffect(() => {
    if (!data.birthPlace) {
      update({ birthPlace: { country, regionId: DEFAULT_REGION_ID[country] } });
    }
    // 최초 마운트 시 1회만 실행 (스킵을 덮어쓰지 않도록)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = (r: Region) => (locale === "ja" ? r.ja : r.ko);
  const query = q.trim().toLowerCase();
  const filtered = regions.filter((r) => label(r).toLowerCase().includes(query));

  const selectedId =
    data.birthPlace && data.birthPlace.country === country
      ? data.birthPlace.regionId
      : null;

  return (
    <div>
      <StepHeading
        title="어디서 태어났나요?"
        sub="출생지 경도로 시(時)를 정밀 보정해요."
        gap="mb-5 md:mb-6"
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="지역 검색"
        aria-label="지역 검색"
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-slate-300 focus:border-accent"
      />

      <ul className="max-h-[240px] overflow-y-auto rounded-[14px] border border-slate-200 divide-y divide-slate-100 md:max-h-[280px]">
        {filtered.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => update({ birthPlace: { country, regionId: r.id } })}
              aria-pressed={selectedId === r.id}
              className={`w-full cursor-pointer px-4 py-3 text-left text-[15px] transition-colors ${
                selectedId === r.id
                  ? "bg-accent-50 font-semibold text-accent"
                  : "text-slate-700"
              }`}
            >
              {label(r)}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-400">검색 결과가 없어요</li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => update({ birthPlace: null })}
        aria-pressed={data.birthPlace === null}
        className={`mt-3.5 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all md:mt-4 md:rounded-[13px] md:px-[18px] md:py-4 ${
          data.birthPlace === null
            ? "border-2 border-accent bg-accent-50 text-accent"
            : "border border-slate-200 bg-white text-slate-500"
        }`}
      >
        <span className="text-[15px] md:text-base">{data.birthPlace === null ? "●" : "○"}</span>
        출생지를 몰라요
      </button>
    </div>
  );
}
