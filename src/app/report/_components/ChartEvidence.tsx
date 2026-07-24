"use client";

import { useState } from "react";
import type {
  ChartEvidence as ChartEvidenceData,
  ElementKey,
  PillarCell,
  PillarColumn,
  TagTone,
} from "../_lib/report-content";

/** 폭 계산 헬퍼 — 동적 값(오행 막대·음양·강약)은 Tailwind 임의값 대신 style로 적용 */
function pct(n: number, d: number): string {
  return `${d > 0 ? Math.round((n / d) * 100) : 0}%`;
}

const EL: Record<
  ElementKey,
  { soft: string; ink: string; bar: string; ko: string; han: string }
> = {
  wood: { soft: "bg-wood-soft", ink: "text-wood-ink", bar: "bg-wood", ko: "목", han: "木" },
  fire: { soft: "bg-fire-soft", ink: "text-fire-ink", bar: "bg-fire", ko: "화", han: "火" },
  earth: { soft: "bg-earth-soft", ink: "text-earth-ink", bar: "bg-earth", ko: "토", han: "土" },
  metal: { soft: "bg-metal-soft", ink: "text-metal-ink", bar: "bg-metal", ko: "금", han: "金" },
  water: { soft: "bg-water-soft", ink: "text-water-ink", bar: "bg-water", ko: "수", han: "水" },
};

const SLOT_LABEL: Record<PillarColumn["slot"], string> = {
  hour: "시주 時",
  day: "일주 日",
  month: "월주 月",
  year: "년주 年",
};

const TAG_TONE_CLASS: Record<TagTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  metal: "bg-metal-soft text-metal-ink",
  fire: "bg-fire-soft text-fire-ink",
  accent: "bg-accent-50 text-accent",
};

function PillarCellBlock({ cell, ringed, marginTop }: { cell: PillarCell; ringed?: boolean; marginTop?: boolean }) {
  const el = EL[cell.element];
  return (
    <div
      className={`${el.soft} rounded-[10px] py-3 text-center ${marginTop ? "mt-1.5" : ""} ${
        ringed ? "ring-2 ring-accent" : ""
      }`}
    >
      <div className={`text-[clamp(24px,5vw,32px)] font-bold leading-none ${el.ink}`}>{cell.char}</div>
      <div className={`text-[11px] font-semibold mt-1 ${el.ink}`}>
        {cell.ko} · {el.han}
      </div>
    </div>
  );
}

function PillarColumnView({ column }: { column: PillarColumn }) {
  const isDay = column.slot === "day";
  return (
    <div>
      <div className={`text-center text-xs font-semibold mb-1.5 ${isDay ? "text-accent" : "text-slate-400"}`}>
        {SLOT_LABEL[column.slot]}
      </div>
      <div className={`text-center text-[11px] mb-[5px] ${isDay ? "text-accent font-semibold" : "text-slate-500"}`}>
        {column.stem.tenGod}
      </div>
      <PillarCellBlock cell={column.stem} ringed={column.isDayMaster} />
      <PillarCellBlock cell={column.branch} marginTop />
      <div className="text-center text-[11px] text-slate-500 mt-[5px]">{column.branch.tenGod}</div>
    </div>
  );
}

export function ChartEvidence({ evidence }: { evidence: ChartEvidenceData }) {
  const [open, setOpen] = useState(false);
  const yinYangTotal = evidence.yinYang.yang + evidence.yinYang.yin;

  return (
    <div className="mt-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full text-left flex items-center gap-3 border border-dashed border-slate-300 bg-slate-50 rounded-xl py-[13px] px-4 cursor-pointer hover:bg-slate-100 hover:border-slate-400 ${
          open ? "rounded-b-none" : ""
        }`}
      >
        <span className="flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13.5px] font-semibold text-slate-600">내 사주의 근거 자세히 보기</span>
          <span className="text-xs text-slate-400">원국 · 오행 · 십성 · 대운</span>
        </span>
        <span
          className={`flex-none w-[22px] h-[22px] rounded-full text-slate-400 flex items-center justify-center text-2xl transition-transform duration-[250ms] ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border border-dashed border-t-0 border-slate-300 rounded-b-xl -mt-1.5 px-[18px] pt-[26px] pb-5 bg-[#FCFDFE]">
          {/* 원국 */}
          <div className="text-[13px] font-bold text-slate-700 mb-3.5">사주 원국 · 四柱</div>
          <div className="grid grid-cols-4 gap-2">
            {evidence.pillars.map((column) => (
              <PillarColumnView key={column.slot} column={column} />
            ))}
          </div>

          {/* 오행 + 음양/강약 */}
          <div className="grid gap-4 mt-6 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <div className="border border-slate-100 rounded-xl py-[18px] px-5">
              <div className="text-[13px] font-bold text-slate-700 mb-3.5">오행 분포</div>
              <div className="flex flex-col gap-[11px]">
                {evidence.elements.map((e) => {
                  const el = EL[e.element];
                  return (
                    <div key={e.element} className="flex items-center gap-2.5">
                      <div className={`w-10 text-[13px] font-semibold ${el.ink}`}>
                        {el.ko} {el.han}
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${el.bar}`} style={{ width: pct(e.count, e.max) }} />
                      </div>
                      <div className="w-[14px] text-right text-[13px] font-semibold">{e.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="border border-slate-100 rounded-xl py-[18px] px-5">
                <div className="flex justify-between mb-2.5">
                  <span className="text-[13px] font-bold text-slate-700">음양 비율</span>
                  <span className="text-xs font-semibold text-slate-500">
                    양 {evidence.yinYang.yang} · 음 {evidence.yinYang.yin}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-amber-500"
                    style={{ width: pct(evidence.yinYang.yang, yinYangTotal) }}
                  />
                  <div className="flex-1 bg-slate-700" />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-amber-700">양陽</span>
                  <span className="text-[11px] text-slate-500">음陰</span>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl py-[18px] px-5">
                <div className="flex justify-between mb-2.5">
                  <span className="text-[13px] font-bold text-slate-700">일간 강약</span>
                  <span className="text-xs font-semibold text-wood-ink">
                    {evidence.strength.level} {evidence.strength.percent}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[linear-gradient(90deg,var(--color-slate-400),var(--color-wood))]"
                    style={{ width: pct(evidence.strength.percent, 100) }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-slate-300">신약</span>
                  <span className="text-[11px] text-slate-300">신강</span>
                </div>
              </div>
            </div>
          </div>

          {/* 십성 · 신살 · 용신 */}
          <div className="border border-slate-100 rounded-xl py-[18px] px-5 mt-4">
            <div className="text-[13px] font-bold text-slate-700 mb-3">십성 · 신살 · 용신</div>
            <div className="flex flex-wrap gap-2">
              {evidence.tags.map((tag, i) => (
                <span
                  key={`${tag.label}-${i}`}
                  className={`text-[13px] font-semibold px-[11px] py-[5px] rounded-lg ${TAG_TONE_CLASS[tag.tone]}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>

          {/* 대운 */}
          <div className="border border-slate-100 rounded-xl pt-[18px] px-5 pb-[14px] mt-4 overflow-x-auto">
            <div className="text-[13px] font-bold text-slate-700 mb-3">대운 흐름 · 10년 주기</div>
            <div className="flex gap-1.5 min-w-[480px]">
              {evidence.daeunStrip.map((d, i) => (
                <div
                  key={`${d.gan}-${i}`}
                  className={`flex-1 text-center py-3 px-1 rounded-[10px] ${
                    d.now ? "bg-accent-50 ring-[1.5px] ring-accent" : "bg-slate-50"
                  }`}
                >
                  <div className={`text-[17px] font-bold ${d.now ? "text-accent" : "text-slate-700"}`}>{d.gan}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{d.age}</div>
                </div>
              ))}
            </div>
          </div>

          {/* disclaimer */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-[18px] mt-4">
            <p className="text-[12.5px] text-slate-400 leading-[1.65] m-0 break-keep [text-wrap:pretty]">
              {evidence.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
