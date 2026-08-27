"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PersonOption } from "@/lib/profiles/option";

interface Props {
  people: PersonOption[];
  /** 지금 상담이 근거로 삼는 사람. 서버가 고른 값이라 목록 안에 반드시 있다. */
  selectedId: string;
}

/**
 * 시안의 "상담에 쓰는 사주" 칸.
 *
 * 없어도 상담은 열렸다 — 대신 상담사가 **누구의** 원국을 근거로 말하는지가 화면
 * 어디에도 없었다. 홈에서 프로필을 골라 들어왔는지(`?profile=`) 계정의 "나" 로
 * 떨어졌는지(defaultConsultationSubject)를 구분할 방법도 없어서, 어머니를 보다가
 * 넘어온 사람은 그 상담이 어머니 것인 줄 알았다.
 *
 * 고른 값은 URL(`?profile=`)에 산다 — 상담을 실제로 여는 POST 가 읽는 것과 같은
 * 값이어야 화면과 근거가 갈리지 않는다. 별도 상태로 들고 있으면 새로고침 한 번에
 * 둘이 어긋난다.
 */
export function SubjectSelect({ people, selectedId }: Props) {
  const router = useRouter();
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
    // replace 다 — 프로필을 바꾼 것은 새 화면이 아니라 같은 화면의 설정이라,
    // push 로 쌓으면 뒤로가기가 목록을 몇 번이고 되짚는다.
    router.replace(`/consult?profile=${encodeURIComponent(id)}`);
  }

  return (
    <div ref={wrapRef} className="relative mt-4">
      <div className="mb-[7px] text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
        상담에 쓰는 사주
      </div>
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
            {/* 시안의 "새 프로필 추가". 프로필을 만드는 길은 퍼널 하나뿐이다.
                퍼널은 끝나면 리빌로 가지 여기로 돌아오지 않는다(?next 를 읽지
                않는다) — 없는 파라미터를 붙여 돌아온다고 약속하지 않는다. */}
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
