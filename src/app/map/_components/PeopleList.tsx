"use client";

import { useEffect, useRef } from "react";
import type { Element } from "@/lib/saju-core";
import type { MapPerson } from "../_data/person";
import { relationNote } from "../_data/relation-notes";
import { roleColor, roleTextColor } from "../_data/role-colors";
import { DISPLAY_TITLES, ROLE_ORDER, ROLE_REGION_NAME } from "../_data/roles";

/**
 * 사이드 패널의 사람 목록. 데스크톱은 우측 400px, 모바일은 하단 판이다 —
 * 그 배치는 MapShell 이 잡고, 이 컴포넌트는 패널 안쪽(헤더 행 + 그룹 목록)만
 * 그린다.
 *
 * 예전에는 상세 시트(PersonSheet)가 따로 있어 목록은 이름만 보여줬다. 시안이
 * 설명을 행 안으로 넣으면서 시트는 사라졌다 — 궁합 단락(relationNote)이 이제
 * 여기서 렌더된다. 그래서 centerElement(지도 주인의 일간 오행)를 받는다.
 *
 * 정렬은 구역 순서(ROLE_ORDER)다. 케미 점수 같은 순위는 두지 않는다 —
 * 순위를 매기는 순간 목록이 관계의 좋고 나쁨을 말하기 시작하고, 그건 이
 * 설계가 3D 쪽에서 내내 피해온 것이다. 빈 구역도 헤더는 그린다(시안) —
 * 다섯 구역이라는 구조 자체가 정보다.
 */
export function PeopleList({
  people,
  centerElement,
  open,
  onToggle,
  selectedId,
  onSelect,
  isOwner,
  onDelete,
}: {
  people: readonly MapPerson[];
  /** 지도 주인의 일간 오행 — 궁합 단락의 오행 다리 문장이 쓴다. */
  centerElement: Element;
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

  // 3D 에서 고른 사람이 목록 밖에 있으면 찾을 수 없다 — 그 행으로 스크롤한다.
  // people 도 의존성에 넣는다: 새로 추가된 사람은 selectedId 가 먼저 서버
  // refresh 로 people 에 그 행이 도착하기 전에 설정되므로, selectedId 만
  // 보면 이 effect 가 행이 아직 없을 때 한 번 뛰고 끝나 버린다.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (selectedId === null) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, people]);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative shrink-0 flex items-center justify-between gap-3 px-5 pt-[17px] pb-[13px] cursor-pointer bg-white border-0 border-b border-slate-100 text-left"
      >
        {/* 모바일 손잡이 */}
        <span className="md:hidden absolute left-1/2 top-1.5 -translate-x-1/2 w-9 h-1 rounded-full bg-slate-200" />
        <span className="text-[14.5px] font-bold tracking-[-0.02em] text-slate-900">
          전체 <span className="text-blue-600">{people.length}</span>명
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-slate-400">
            {open ? "접기" : "펼치기"}
          </span>
          <span
            aria-hidden
            className={`grid place-items-center w-[22px] h-[22px] rounded-full bg-slate-100 text-slate-500 text-[11px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </span>
      </button>

      {open && (
        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(18px,env(safe-area-inset-bottom))] m-0 list-none">
          {byRole.map(({ role, people }) => (
            <li key={role} className="pt-2.5">
              <p className="flex items-center gap-[7px] px-2 pb-0.5 m-0">
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: roleColor(role) }}
                />
                <span
                  className="text-[13px] font-bold tracking-[-0.01em]"
                  style={{ color: roleTextColor(role) }}
                >
                  {ROLE_REGION_NAME[role]}
                </span>
                <span className="text-[12.5px] font-semibold text-slate-300 tabular-nums">
                  {people.length}
                </span>
              </p>
              <ul className="m-0 p-0 list-none">
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    centerElement={centerElement}
                    selected={person.id === selectedId}
                    onSelect={onSelect}
                    isOwner={isOwner}
                    onDelete={onDelete}
                    rowRef={(el) => {
                      if (el) rowRefs.current.set(person.id, el);
                      else rowRefs.current.delete(person.id);
                    }}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PersonRow({
  person,
  centerElement,
  selected,
  onSelect,
  isOwner,
  onDelete,
  rowRef,
}: {
  person: MapPerson;
  centerElement: Element;
  selected: boolean;
  onSelect: (id: string) => void;
  isOwner: boolean;
  onDelete: (id: string) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const graphic = roleColor(person.role);
  const text = roleTextColor(person.role);

  return (
    <li>
      {/*
        행이 <button> 이 아니라 role="button" 인 div 인 이유: 소유자에게는 안에
        지우기 버튼이 들어간다. HTML5 는 button 안의 button 을 금지하고, 파서가
        고쳐 놓은 결과가 브라우저마다 달라 안쪽 컨트롤이 보조기기에 어떻게
        노출되는지가 정의되지 않는다. 그래서 바깥을 div 로 내리고 키보드 동작을
        직접 단다 — 지우기는 그 안의 진짜 형제 button 으로 남는다.
      */}
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(person.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onSelect(person.id);
        }}
        className={`
          w-full flex items-start gap-[11px] text-left px-2 py-[11px] pl-[21px] rounded-xl cursor-pointer border-0
          ${selected ? "bg-blue-50/70" : "bg-transparent"}
        `}
      >
        {/* 아바타는 그 사람의 구역 색이다 — 목록과 월드가 같은 색으로 이어진다. */}
        <span
          aria-hidden
          className="shrink-0 grid place-items-center w-[34px] h-[34px] rounded-full text-[13.5px] font-bold mt-0.5"
          style={{ backgroundColor: `${graphic}1f`, color: text }}
        >
          {person.name.slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-[7px]">
            <span className="text-[14.5px] font-bold tracking-[-0.02em] text-slate-900">
              {person.name}
            </span>
            {/* 별명 15개가 소구역(기본·六合·沖)까지 이미 구분한다 — 六合/沖 라벨은 따로 안 단다. */}
            <span className="text-[11.5px] font-bold" style={{ color: text }}>
              {DISPLAY_TITLES[person.role][person.feature]}
            </span>
          </span>
          <span className="block text-[13.5px] font-semibold text-slate-700 mt-0.5 tracking-[-0.01em]">
            {person.sceneName}
          </span>
          <span className="block text-[13px] leading-relaxed text-slate-500 mt-0.5 [text-wrap:pretty]">
            {relationNote(centerElement, person.role, person.feature)}
          </span>
          {person.sameDayPillar && (
            // 六合 도 沖 도 아니라 배치로는 말할 수 없는 사실이다. 여기서만 말한다.
            <span className="block text-[12px] text-slate-400 mt-1">일주가 통째로 같아요.</span>
          )}
        </span>

        {isOwner && (
          <button
            type="button"
            aria-label={`${person.name} 지우기`}
            onClick={(e) => {
              // 행 전체가 선택 버튼이다 — 삭제가 선택으로 새면 지우자마자 카메라가 날아간다.
              e.stopPropagation();
              onDelete(person.id);
            }}
            className="shrink-0 px-1 py-0.5 text-[12.5px] font-semibold text-slate-300 bg-transparent border-0 cursor-pointer hover:text-rose-500"
          >
            지우기
          </button>
        )}
      </div>
    </li>
  );
}
