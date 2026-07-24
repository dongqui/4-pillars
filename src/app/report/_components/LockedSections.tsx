"use client";
import { useEffect, useRef, useState } from "react";
import type { LockedSectionMeta } from "../_lib/report-content";

export function LockedSections({ sections }: { sections: LockedSectionMeta[] }) {
  const inlineRef = useRef<HTMLAnchorElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      let show = window.scrollY > 500;
      const el = inlineRef.current;
      if (show && el && el.getBoundingClientRect().top < window.innerHeight) show = false;
      setShowBar((prev) => (prev !== show ? show : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <section className="mt-[72px] flex flex-col gap-3">
        {sections.map((s) => (
          <div key={s.no} className="flex items-center justify-between gap-3.5 bg-slate-50 border border-slate-200 rounded-2xl px-[22px] py-5">
            <div>
              <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-1">{s.no} · {s.category}</div>
              <div className="text-[15.5px] font-bold text-slate-700">{s.title}</div>
            </div>
            <div className="flex-none w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px]">🔒</div>
          </div>
        ))}
        <div className="mt-5 text-center flex flex-col items-center gap-3.5">
          <p className="text-[15px] text-slate-500 m-0 [text-wrap:pretty]">나머지 결과가 궁금하신가요?</p>
          <a ref={inlineRef} href="#" className="block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-4 rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.28)] text-center hover:bg-accent-700">전체 결과 보기</a>
        </div>
      </section>
      {showBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-[clamp(20px,5vw,24px)] pt-7 pb-[18px] bg-gradient-to-b from-transparent to-white to-[55%] pointer-events-none">
          <div className="max-w-[720px] mx-auto flex justify-center">
            <a href="#" className="pointer-events-auto block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-[15px] rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.32)] text-center hover:bg-accent-700">전체 결과 보기</a>
          </div>
        </div>
      )}
    </>
  );
}
