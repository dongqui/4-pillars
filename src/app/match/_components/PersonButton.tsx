"use client";

import type { PersonOption } from "../_lib/to-person-option";

const BTN =
  "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors";
const BTN_ON = "border-accent bg-accent-50";
const BTN_OFF = "border-slate-200 bg-white hover:border-slate-300";

interface Props {
  person: PersonOption;
  selected: boolean;
  onClick: () => void;
}

/**
 * 아바타 이니셜 + 이름 + 생년월일 한 줄짜리 카드. "나" 선택과 저장된 상대 목록이
 * 같은 카드를 쓴다 — 한쪽 스타일만 바뀌고 다른 쪽이 뒤처지는 일을 막는다.
 */
export function PersonButton({ person, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${BTN} ${selected ? BTN_ON : BTN_OFF}`}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-[13.5px] font-bold text-slate-500">
        {person.initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-slate-900">
          {person.name}
        </span>
        <span className="block text-[12.5px] text-slate-400">{person.birthLabel}</span>
      </span>
    </button>
  );
}
