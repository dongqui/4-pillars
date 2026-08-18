"use client";
import { useEffect, useRef, useState } from "react";
import type { LockedSectionMeta } from "../_lib/report-content";
import { useUnlock } from "../_hooks/use-unlock";

export function LockedSections({
  sections,
  isLoggedIn,
  profileId,
}: {
  sections: LockedSectionMeta[];
  isLoggedIn: boolean;
  /**
   * 픽스처 데모, 그리고 로그인했지만 드래프트 승격이 실패했거나 프로필 한도를
   * 채운 경우에 없다. 열 대상이 없으므로 로그인 버튼(cta)이 아예 사라진다.
   */
  profileId?: string;
}) {
  const inlineRef = useRef<HTMLDivElement>(null);
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

  const { unlock, status, error } = useUnlock(profileId);
  const pending = status === "pending";

  // 이용권을 쓰려면 계정이 있어야 한다. 비로그인에게는 이 버튼의 첫 단계가 로그인이고,
  // 로그인하는 순간 퍼널에서 맡겨둔 드래프트가 프로필로 승격된다.
  const loginHref = `/login?next=${encodeURIComponent("/report")}`;
  const label = pending ? "여는 중이에요…" : "이용권 1장으로 전체 보기";

  const CTA_CLASS =
    "block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-4 rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.28)] text-center hover:bg-accent-700 disabled:opacity-60";

  // 비로그인은 링크, 로그인은 버튼이다 — 링크로 두면 차감이 GET 이 되고,
  // 버튼으로 두면 비로그인이 로그인 화면으로 못 간다.
  // 로그인했는데 profileId 가 없으면(드래프트 승격 실패, 프로필 한도 초과 등) 버튼을
  // 아예 숨긴다 — 눌러도 아무것도 못 여는 버튼은 사용자가 오류로 읽는다.
  const cta = !isLoggedIn ? (
    <a href={loginHref} className={CTA_CLASS}>
      로그인하고 전체 결과 보기
    </a>
  ) : profileId ? (
    <button type="button" onClick={unlock} disabled={pending} className={CTA_CLASS}>
      {label}
    </button>
  ) : null;

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
        <div ref={inlineRef} className="mt-5 text-center flex flex-col items-center gap-3.5">
          <p className="text-[15px] text-slate-500 m-0 [text-wrap:pretty]">
            나머지 결과가 궁금하신가요?
          </p>
          {cta}
          {error && (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>
      </section>
      {showBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-[clamp(20px,5vw,24px)] pt-7 pb-[18px] bg-gradient-to-b from-transparent to-white to-[55%] pointer-events-none">
          <div className="max-w-[720px] mx-auto flex justify-center [&>*]:pointer-events-auto">
            {cta}
          </div>
        </div>
      )}
    </>
  );
}
