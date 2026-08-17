"use client";

import type { PersonOption } from "../_lib/to-person-option";
import { PersonButton } from "./PersonButton";

interface Props {
  people: PersonOption[];
  selectedId: string | null;
  onSelect: (person: PersonOption) => void;
  /** 목록이 비었을 때 보여줄 문구. 생략하면 빈 목록도 그냥 빈 그리드로 그린다
   *  (예: "나" 목록은 페이지가 미리 걸러 항상 채워져 있다는 걸 보장한다). */
  emptyMessage?: string;
}

/** 나 · 저장된 상대 목록이 공유하는 그리드 — PersonButton 을 늘어놓는 자리만 맡는다. */
export function PersonList({ people, selectedId, onSelect, emptyMessage }: Props) {
  if (people.length === 0 && emptyMessage) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13.5px] text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {people.map((p) => (
        <PersonButton
          key={p.id}
          person={p}
          selected={selectedId === p.id}
          onClick={() => onSelect(p)}
        />
      ))}
    </div>
  );
}
