"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CharacterCard } from "@/components/character-card/CharacterCard";
import { CARD_TONES } from "@/components/character-card/tokens";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import { HANDOFF_KEY } from "@/lib/characters/handoff";
import type { HomeEntry } from "../_lib/to-home-entry";
import { ExploreGrid } from "./ExploreGrid";

interface Props {
  entries: HomeEntry[];
  /** 프로필을 더 만들 수 있는지 — 한도에 닿으면 추가 버튼을 잠근다 */
  canAdd: boolean;
}

const ADD_HREF = "/funnel?step=name";

/**
 * 아직 계정이 없는 사람의 리포트. 로그인을 먼저 시키지 않는다 — 무료 섹션은 드래프트의
 * 실데이터로 그대로 보여주고, 잠긴 섹션의 CTA 가 로그인(=드래프트 승격) → 결제로 이어진다.
 */
const DRAFT_REPORT_HREF = "/report";

/**
 * 프로필 셀렉터 + 캐릭터 카드 + 탐색 그리드.
 *
 * 셋을 한 컴포넌트에 두는 이유는 "보고 있는 사주" 하나가 세 곳을 동시에 바꾸기
 * 때문이다 — 셀렉터를 넘기면 카드도 리포트 링크도 같이 따라가야 한다.
 */
export function HomeIdentity({ entries, canAdd }: Props) {
  const vw = useViewportWidth();
  const mobile = vw < MOBILE_MAX;
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 리빌에서 넘어온 첫 진입에만 카드가 이어받는 연출을 켠다. 신호는 한 번 쓰고 지운다.
  // state 가 아니라 클래스를 직접 붙이는 이유: 서버에는 sessionStorage 가 없어 첫
  // 렌더에는 무엇도 알 수 없고, state 로 두면 그 사실 하나 때문에 전체가 한 번 더 그려진다.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HANDOFF_KEY) === null) return;
      sessionStorage.removeItem(HANDOFF_KEY);
      cardRef.current?.classList.add("pv-handoff");
    } catch {
      // 스토리지를 못 읽으면 연출만 빠진다
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = entries[Math.min(index, entries.length - 1)];
  const cardW = mobile ? Math.min(vw - 40, 356) : 500;
  const tone = active.character ? CARD_TONES[active.character.family.element] : null;

  return (
    <>
      <section className="bg-[linear-gradient(180deg,#F7F9FB_0%,#FBFCFD_62%,#fff_100%)] py-[18px] md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[780px] flex-col items-stretch px-5 md:items-center md:px-8">
          <div
            ref={wrapRef}
            className="relative z-20 mb-3.5 w-full"
            style={{ maxWidth: cardW }}
          >
            <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
              보고 있는 사주
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((v) => !v)}
                disabled={entries.length < 2}
                className={`flex h-[52px] min-w-0 flex-1 items-center gap-[11px] rounded-[14px] border bg-white px-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)] ${
                  open ? "border-accent" : "border-slate-200"
                } ${entries.length < 2 ? "cursor-default" : "cursor-pointer"}`}
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13.5px] font-bold"
                  style={
                    tone
                      ? { background: tone.surface, color: tone.accent }
                      : { background: "#F1F5F9", color: "#94A3B8" }
                  }
                >
                  {active.initial}
                </span>
                <span className="flex min-w-0 flex-col items-start gap-px">
                  <span className="text-[15.5px] font-bold leading-[1.2] tracking-[-0.025em]">
                    {active.name}
                  </span>
                  <span className="max-w-[190px] truncate text-[12.5px] leading-[1.2] text-slate-400">
                    {active.character?.scene.name ?? "캐릭터를 세울 수 없어요"}
                  </span>
                </span>
                {entries.length > 1 && (
                  <span
                    aria-hidden
                    className={`ml-auto flex-none text-[11px] text-slate-400 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                )}
              </button>

              {canAdd ? (
                <Link
                  href={ADD_HREF}
                  className="flex h-[52px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-[15px] text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent"
                >
                  <span className="text-[17px] font-normal leading-none">+</span>
                  {mobile ? "프로필" : "프로필 추가"}
                </Link>
              ) : (
                <span
                  aria-disabled
                  title="프로필이 가득 찼어요"
                  className="flex h-[52px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-[15px] text-sm font-semibold text-slate-300"
                >
                  <span className="text-[17px] font-normal leading-none">+</span>
                  {mobile ? "프로필" : "프로필 추가"}
                </span>
              )}
            </div>

            {open && (
              <div
                id={panelId}
                role="listbox"
                aria-label="사주 고르기"
                className="pv-rise absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_44px_-20px_rgba(15,23,42,.32)]"
              >
                {entries.map((entry, i) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    onClick={() => {
                      setIndex(i);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-start gap-2.5 px-3.5 py-3 text-left ${
                      i === index ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`w-4 flex-none pt-[3px] text-xs font-bold ${
                        i === index ? "text-accent" : "text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold tracking-[-0.02em]">
                        {entry.name}
                      </span>
                      <span className="mt-px block truncate text-[13px] text-slate-400">
                        {entry.character?.scene.name ?? "캐릭터를 세울 수 없어요"}
                      </span>
                    </span>
                  </button>
                ))}
                <div className="border-t border-slate-100 p-1.5">
                  <Link
                    href={ADD_HREF}
                    className="flex items-center gap-2.5 rounded-[11px] px-3 py-3 text-[14.5px] font-semibold text-accent hover:bg-slate-50"
                  >
                    <span className="text-[17px] font-normal leading-none">+</span>새 프로필 추가
                  </Link>
                </div>
              </div>
            )}
          </div>

          {active.character ? (
            <div ref={cardRef}>
              <CharacterCard
                character={active.character}
                w={cardW}
                zoomW={mobile ? cardW : 460}
              />
            </div>
          ) : (
            <div
              className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center"
              style={{ width: cardW }}
            >
              <p className="text-[15px] font-semibold">이 프로필로는 캐릭터를 세울 수 없어요</p>
              <p className="mt-1.5 text-[13px] text-slate-400 [text-wrap:pretty]">
                저장된 생년월일이 계산 가능한 범위(1900~2050년)를 벗어났어요.
              </p>
            </div>
          )}
        </div>
      </section>

      <ExploreGrid
        reportHref={
          active.profileId ? `/report?profile=${active.profileId}` : DRAFT_REPORT_HREF
        }
      />
    </>
  );
}
