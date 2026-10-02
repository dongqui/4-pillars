"use client";
import { useEffect, useState } from "react";
import {
  HANDOFF_KEY,
  activeStepIndex,
  estimateProgress,
  resolveStartedAt,
} from "./progress";
import { LOADING_PRESETS, LOADING_TIPS, type LoadingPresetKey } from "./presets";

const TICK_MS = 200;
const TIP_MS = 4_600;

/**
 * 오래 걸리는 LLM 대기의 공용 화면. 시안: design/project/Saju Report Loading.dc.html.
 *
 * - page: Suspense fallback. 셸 <main> 안에 들어가므로 높이를 강제하지 않는다.
 * - overlay: CTA 를 누른 직후 화면 전체를 덮는다. 도착 페이지의 page fallback 이
 *   시작 시각을 이어받는다(progress.ts 의 HANDOFF_KEY).
 */
export function LoadingScreen({
  preset,
  variant = "page",
  title,
}: {
  preset: LoadingPresetKey;
  variant?: "page" | "overlay";
  title?: string;
}) {
  const p = LOADING_PRESETS[preset];
  // SSR 과 첫 하이드레이션이 같게 0 에서 시작한다 — 시각은 effect 에서만 읽는다.
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const now = Date.now();
    let startedAt = now;
    try {
      if (variant === "overlay") {
        sessionStorage.setItem(HANDOFF_KEY, String(now));
      } else {
        startedAt = resolveStartedAt(sessionStorage.getItem(HANDOFF_KEY), now);
        sessionStorage.removeItem(HANDOFF_KEY);
      }
    } catch {
      // 저장소를 막은 브라우저 — 이어받지 못할 뿐 화면은 그대로 돈다.
    }
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, TICK_MS);
    const tipT = setInterval(() => setTip((i) => (i + 1) % LOADING_TIPS.length), TIP_MS);
    return () => {
      clearInterval(t);
      clearInterval(tipT);
    };
  }, [variant]);

  const progress = estimateProgress(elapsed, p.expectedMs);
  const active = activeStepIndex(progress, p.steps.length);
  const pct = Math.round(progress * 100);

  const body = (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[520px] px-6">
      <div className="relative mx-auto mb-8 h-[120px] w-[120px]">
        <div className="ld-breathe absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,.16),rgba(37,99,235,0)_68%)]" />
        <div className="absolute inset-[14px] rounded-full border-[1.5px] border-accent-100" />
        <div className="ld-spin absolute inset-[14px] rounded-full border-2 border-transparent border-t-accent" />
        <div className="absolute inset-0 flex items-center justify-center text-[26px] font-bold tracking-[-0.04em] text-accent tabular-nums">
          {pct}%
        </div>
      </div>

      <div className="mb-7 text-center">
        <h2 className="m-0 mb-2 text-[clamp(21px,4vw,25px)] font-bold tracking-[-0.035em] [text-wrap:balance]">
          {title ?? p.title}
        </h2>
        <p className="m-0 text-[14.5px] text-slate-400">{p.note}</p>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          // width transition 은 두지 않는다 — 200ms 마다 목표가 바뀌어 전환이 계속 새로
          // 시작되면 바가 숫자보다 한참 뒤처진다. 틱 간격만으로 충분히 매끄럽다.
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-400"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="m-0 mb-5 list-none rounded-[20px] border border-slate-100 bg-white px-[22px] py-2 shadow-[0_1px_3px_rgba(17,24,39,.04)]">
        {p.steps.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li
              key={s.label}
              className="flex items-start gap-[13px] border-b border-slate-50 py-[14px] last:border-b-0"
            >
              <span
                aria-hidden
                className={`mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                  done
                    ? "bg-accent text-white"
                    : now
                      ? "ld-spin border-2 border-accent border-t-transparent"
                      : "border border-slate-100 bg-slate-50"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[15px] tracking-[-0.01em] ${
                    done || now ? "font-semibold text-slate-900" : "font-medium text-slate-300"
                  }`}
                >
                  {s.label}
                </span>
                {now && <span className="ld-rise mt-0.5 block text-[13px] text-slate-400">{s.sub}</span>}
              </span>
              {done && <span className="flex-none text-[12.5px] font-semibold text-slate-300">완료</span>}
            </li>
          );
        })}
      </ol>

      <div className="rounded-[20px] border border-slate-100 bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(17,24,39,.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[12px] font-bold tracking-[0.04em] text-accent">알고 계셨나요</span>
        </div>
        <p key={tip} className="ld-rise m-0 min-h-[51px] text-[15px] leading-[1.7] text-slate-700 [text-wrap:pretty]">
          {LOADING_TIPS[tip]}
        </p>
        <div aria-hidden className="mt-3.5 flex gap-[5px]">
          {LOADING_TIPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === tip ? "w-[18px] bg-accent" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="saju-fade fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-white py-[clamp(32px,6vw,64px)]">
        {body}
      </div>
    );
  }
  return <div className="py-[clamp(40px,8vw,80px)]">{body}</div>;
}
