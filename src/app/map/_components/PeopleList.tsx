"use client";

import type { MapPerson } from "../_data/person";
import { roleColor } from "../_data/role-colors";
import {
  DISPLAY_TITLES,
  FEATURE_LABELS,
  ROLE_ICON,
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_REGION_NAME,
} from "../_data/roles";

/**
 * 전체 사람 목록. 접었을 때는 손잡이 한 줄, 폈을 때는 스크롤되는 목록이다.
 *
 * 3D 월드만으로는 "누가 있더라"를 훑을 수 없다 — 카메라를 돌려야 하고, 뒤에
 * 있는 사람은 아예 안 보인다. 목록은 그 반대의 일을 한다: 순서대로, 빠짐없이,
 * 한 번에.
 *
 * 정렬은 구역 순서(ROLE_ORDER)를 따른다. 케미 점수 같은 순위는 두지 않는다 —
 * 순위를 매기는 순간 목록이 관계의 좋고 나쁨을 말하기 시작하고, 그건 이
 * 설계가 3D 쪽에서 내내 피해온 것이다.
 *
 * 시트와 동시에 열리지 않는다. 둘 다 화면 아래에서 올라오는 판이라 겹치면
 * 어느 쪽을 닫는 건지 알 수 없다. 목록에서 사람을 고르면 목록이 접히고
 * 시트가 열린다.
 */
export function PeopleList({
  people,
  open,
  onToggle,
  selectedId,
  onSelect,
  isOwner,
  onDelete,
}: {
  people: readonly MapPerson[];
  open: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 소유자만 삭제 버튼을 본다. 누구나 추가할 수 있으니 지울 사람이 있어야 한다. */
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const byRole = ROLE_ORDER.map((role) => ({
    role,
    people: people.filter((p) => p.role === role),
  }));

  return (
    <div
      className={`
        fixed inset-x-0 bottom-0 z-30 flex flex-col
        bg-slate-900/95 backdrop-blur-md border-t border-slate-700/60
        transition-[height] duration-300 ease-out
        ${open ? "h-[68vh]" : "h-[max(56px,calc(44px+env(safe-area-inset-bottom)))]"}
      `}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="shrink-0 flex items-center justify-between gap-3 px-5 h-14 cursor-pointer bg-transparent border-0 text-left"
      >
        <span className="text-[14px] font-semibold text-slate-100">
          전체 {people.length}명
        </span>
        <span className="flex items-center gap-2">
          {/* 접혀 있을 때도 구역별 인원은 보인다 — 펴야만 알 수 있으면 손잡이가 아니다. */}
          {!open &&
            ROLE_ORDER.map((role) => (
              <span
                key={role}
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: roleColor(role) }}
              >
                {people.filter((p) => p.role === role).length}
              </span>
            ))}
          <span
            className={`text-slate-400 text-[12px] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▲
          </span>
        </span>
      </button>

      {open && (
        <ul className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(16px,env(safe-area-inset-bottom))] m-0 list-none">
          {byRole.map(({ role, people }) => (
            <li key={role} className="mb-1">
              <p className="flex items-center gap-1.5 px-2 pt-3 pb-1 m-0 text-[11px] font-semibold tracking-[0.04em]">
                <span aria-hidden>{ROLE_ICON[role]}</span>
                <span style={{ color: roleColor(role) }}>{ROLE_REGION_NAME[role]}</span>
                <span className="text-slate-500 tabular-nums">{people.length}</span>
              </p>
              <ul className="m-0 p-0 list-none">
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    selected={person.id === selectedId}
                    onSelect={onSelect}
                    isOwner={isOwner}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonRow({
  person,
  selected,
  onSelect,
  isOwner,
  onDelete,
}: {
  person: MapPerson;
  selected: boolean;
  onSelect: (id: string) => void;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const color = roleColor(person.role);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(person.id)}
        className={`
          w-full flex items-start gap-3 text-left px-2 py-2.5 rounded-xl cursor-pointer border-0
          ${selected ? "bg-slate-700/50" : "bg-transparent"}
        `}
      >
        {/* 아바타는 그 사람의 구역 색이다 — 목록과 월드가 같은 색으로 이어진다. */}
        <span
          aria-hidden
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-[13px] font-bold"
          style={{ backgroundColor: `${color}26`, color, border: `1px solid ${color}59` }}
        >
          {person.name.slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold text-slate-100">{person.name}</span>
            <span className="text-[12px] font-semibold" style={{ color }}>
              {DISPLAY_TITLES[person.role][person.feature]}
            </span>
            {person.feature !== "none" && (
              <span className="text-[10px] text-slate-400">
                {FEATURE_LABELS[person.feature]}
              </span>
            )}
          </span>
          <span className="block text-[12px] text-slate-400 mt-0.5">{person.sceneName}</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            {ROLE_LABELS[person.role]}
          </span>
        </span>

        {isOwner && (
          <button
            type="button"
            aria-label={`${person.name} 지우기`}
            onClick={(e) => {
              // 행 전체가 선택 버튼이다 — 삭제가 선택으로 새면 지우자마자 시트가 열린다.
              e.stopPropagation();
              onDelete(person.id);
            }}
            className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[12px] text-slate-500 hover:bg-white/10 hover:text-slate-300"
          >
            지우기
          </button>
        )}
      </button>
    </li>
  );
}
