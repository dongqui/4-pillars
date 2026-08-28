"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { PersonOption } from "@/lib/profiles/option";

interface Props {
  people: PersonOption[];
  /** 지금 고른 사람. 목록 안에 반드시 있어야 한다(없으면 첫 줄로 보인다) */
  selectedId: string;
  /** 다른 사람을 골랐을 때. selectedId 와 같은 것을 다시 고르면 부르지 않는다 */
  onPick: (id: string) => void;
}

/**
 * 아바타 · 이름 · 생년월일 줄을 가진 드롭다운의 화면 부분.
 *
 * consult 의 SubjectSelect 가 원래 통째로 갖고 있던 것 — 바깥 클릭 닫기, Escape,
 * aria-expanded/aria-controls, 아바타, "새 프로필 추가" — 을 여기로 뽑았다. 흐름
 * 선택 화면도 같은 모양의 드롭다운이 필요해졌는데, 손으로 다시 만들면 SubjectSelect
 * 가 이미 다듬어 둔 접근성을 더 나쁘게 복제하게 된다(레이블·URL 이동은 화면마다
 * 다르므로 그건 호출부 몫으로 남긴다).
 *
 * 고른 값을 어디에 두는지(URL 인가 로컬 상태인가)는 여기서 모른다 — onPick 콜백만
 * 받는다. SubjectSelect 는 router.replace 로, 흐름 선택 화면은 useState 로 받는다.
 */
export function PersonPicker({ people, selectedId, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = people.find((p) => p.id === selectedId) ?? people[0];

  function pick(id: string) {
    setOpen(false);
    if (id === selectedId) return;
    onPick(id);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex w-full items-center gap-2.5 rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-accent-50 text-[13px] font-bold text-accent">
          {selected.initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold leading-[1.25] tracking-[-0.02em]">
            {selected.name}
          </span>
          <span className="mt-px block truncate text-[12px] leading-[1.3] text-slate-400">
            {selected.birthLabel}
          </span>
        </span>
        <span
          aria-hidden
          className={`flex-none text-[11px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_16px_36px_-20px_rgba(15,23,42,0.34)]"
        >
          {people.map((p) => {
            const on = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.id)}
                aria-pressed={on}
                className={`flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-[11px] text-left hover:bg-slate-50 ${
                  on ? "bg-slate-50" : "bg-white"
                }`}
              >
                {/* 자리를 늘 차지하게 둔다 — 체크가 나타나고 사라질 때 줄이 흔들리지 않는다 */}
                <span
                  aria-hidden
                  className={`w-4 flex-none text-[13px] font-bold text-accent ${on ? "opacity-100" : "opacity-0"}`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold tracking-[-0.02em] text-slate-900">
                    {p.name}
                  </span>
                  <span className="mt-px block truncate text-[12px] text-slate-400">
                    {p.birthLabel}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="border-t border-slate-100 p-[5px]">
            {/* 프로필을 만드는 길은 퍼널 하나뿐이다. 퍼널은 끝나면 리빌로 가지 여기로
                돌아오지 않는다(?next 를 읽지 않는다) — 없는 파라미터를 붙여 돌아온다고
                약속하지 않는다. */}
            <Link
              href="/funnel?step=name"
              className="flex items-center gap-2 rounded-[10px] px-[11px] py-[11px] text-[14px] font-semibold text-accent hover:bg-slate-50"
            >
              <span aria-hidden className="text-[16px] font-normal leading-none">
                +
              </span>
              새 프로필 추가
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
