"use client";

import { useEffect, useMemo, useState } from "react";
import { useFunnel } from "../../_context/FunnelContext";
import { getLocale, localeToCountry } from "../../_lib/locale";
import { getRegions, DEFAULT_REGION_ID, type Region } from "../../_lib/regions";

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
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        어디서 태어났나요?
      </h1>
      <p className="text-[15px] text-slate-500 mb-6">출생지 경도로 시(時)를 정밀 보정해요.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="지역 검색"
        aria-label="지역 검색"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-accent placeholder:text-slate-300 mb-3"
      />

      <ul className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {filtered.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => update({ birthPlace: { country, regionId: r.id } })}
              aria-pressed={selectedId === r.id}
              className={`w-full text-left px-4 py-3 text-[15px] transition-colors ${
                selectedId === r.id
                  ? "bg-accent-50 text-accent font-semibold"
                  : "text-slate-700"
              }`}
            >
              {label(r)}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-[14px] text-slate-400">검색 결과가 없어요</li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => update({ birthPlace: null })}
        aria-pressed={data.birthPlace === null}
        className={`w-full flex items-center gap-2.5 mt-4 text-sm font-semibold rounded-xl px-[18px] py-4 transition-all cursor-pointer border ${
          data.birthPlace === null
            ? "border-2 border-accent bg-accent-50 text-accent"
            : "border-slate-200 bg-white text-slate-500"
        }`}
      >
        <span className="text-base">{data.birthPlace === null ? "●" : "○"}</span>
        출생지를 몰라요
      </button>
    </div>
  );
}
