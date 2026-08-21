"use client";

import type { ReactNode } from "react";
import type { PersonOption } from "../_lib/to-person-option";

const AVATAR = "flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl text-sm font-bold";
const AVATAR_ON = "bg-accent-50 text-accent";
const AVATAR_OFF = "bg-slate-100 text-slate-400";

interface Props {
  /** "나는 누구인가요?" */
  title: string;
  /** 제목 아래 한 줄 */
  hint: string;
  /** 제목 오른쪽 — "내 사주 2개" */
  countLabel: string;
  /** 아무도 고르지 않았을 때 접힌 버튼에 뜨는 문구 */
  placeholder: string;
  people: PersonOption[];
  selected: PersonOption | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (person: PersonOption) => void;
  /** 목록 맨 아래 줄 — "내 사주 추가하기" */
  addLabel: string;
  onAdd: () => void;
  /** 열려 있을 때 목록 아래에 붙는 입력 폼 */
  children?: ReactNode;
}

/**
 * 접힌 버튼 하나 + 펼친 목록. "나" 와 "상대" 가 같은 컴포넌트를 쓴다 — 한쪽만
 * 손보다 두 칸의 모양이 갈라지는 일을 막는다(예전 PersonButton 이 맡던 자리다).
 *
 * 목록을 항상 펼쳐 두지 않는 이유는 시안의 판단이다: 고르고 나면 그 칸에서 할 일이
 * 끝나므로, 세 칸(나 · 상대 · 관계)이 한 화면에 같이 보이는 편이 낫다.
 */
export function PersonSelect({
  title,
  hint,
  countLabel,
  placeholder,
  people,
  selected,
  open,
  onToggle,
  onSelect,
  addLabel,
  onAdd,
  children,
}: Props) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
        <span className="text-[12px] text-slate-400">{countLabel}</span>
      </div>
      <p className="mb-3 text-[13px] text-slate-400">{hint}</p>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-[15px] py-[13px] text-left transition-colors hover:border-slate-300"
      >
        <span className={`${AVATAR} ${selected ? AVATAR_ON : AVATAR_OFF}`}>
          {selected ? selected.initial : "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15px] font-semibold tracking-[-0.01em] ${
              selected ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {selected ? selected.name : placeholder}
          </span>
          {selected && (
            <span className="mt-0.5 block font-mono text-[12px] text-slate-400">
              {subLabel(selected)}
            </span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_12px_28px_-18px_rgba(15,23,42,.24)]">
          {people.map((p) => {
            const on = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-[15px] py-3 text-left hover:bg-slate-50 ${
                  on ? "bg-slate-50" : "bg-white"
                }`}
              >
                <span className={`${AVATAR} ${on ? AVATAR_ON : AVATAR_OFF}`}>{p.initial}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em]">
                    {p.name}
                  </span>
                  <span className="mt-px block font-mono text-[12px] text-slate-400">
                    {subLabel(p)}
                  </span>
                </span>
                {/* 자리를 늘 차지하게 둔다 — 체크가 나타나고 사라질 때 줄이 흔들리지 않는다 */}
                <Check on={on} />
              </button>
            );
          })}

          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center gap-2.5 px-[15px] py-[13px] text-left text-sm font-semibold text-accent hover:bg-slate-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {addLabel}
          </button>
        </div>
      )}

      {children}
    </section>
  );
}

/** 저장하지 않기로 한 줄은 그 사실이 목록에서 바로 보여야 한다 — 다음에 없을 사람이다. */
function subLabel(person: PersonOption): string {
  return person.saved ? person.birthLabel : `${person.birthLabel} · 저장 안 함`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`flex-none text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`flex-none text-accent ${on ? "opacity-100" : "opacity-0"}`}
    >
      <path
        d="M3.5 8.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
