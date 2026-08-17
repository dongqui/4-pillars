"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { hasLeapMonth } from "@/lib/saju-core";
import type { CreateProfileBody } from "@/lib/profiles/input";
import type { PersonOption } from "../_lib/to-person-option";

/**
 * 상대 선택값. "saved" 는 이미 있는 프로필 id 하나, "new" 는 즉석 입력 —
 * MatchForm 이 이 kind 로 submit 본문의 두 필드(counterpartProfileId | counterpart) 중
 * 정확히 하나만 채운다. name 은 두 갈래 모두에 둬서 RelationPicker 가 프로필을
 * 다시 조회하지 않고 라벨에 바로 쓸 수 있게 한다.
 */
export type CounterpartValue =
  | { kind: "saved"; profileId: string; name: string }
  | { kind: "new"; input: CreateProfileBody; name: string };

interface Props {
  /** 저장된 후보 전체 — self/other 둘 다. "나"로 고른 사람은 부모가 걸러서 넘긴다. */
  people: PersonOption[];
  /** 나로 선택된 프로필 id — 자기 자신을 상대로 고르지 못하게 목록에서 뺀다 */
  excludeId: string;
  value: CounterpartValue | null;
  onChange: (next: CounterpartValue | null) => void;
}

type Segment = "saved" | "new";

const CURRENT_YEAR = new Date().getFullYear();

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

interface Draft {
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  y: string;
  m: string;
  d: string;
  timeKnown: boolean;
  h: string;
  min: string;
}

const emptyDraft: Draft = {
  name: "",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  y: "",
  m: "",
  d: "",
  timeKnown: true,
  h: "",
  min: "",
};

/** 입력이 완전하지 않으면 null — MatchForm 은 counterpart 가 null 인 동안 제출을 막는다. */
function toCounterpart(draft: Draft): CounterpartValue | null {
  const name = draft.name.trim();
  if (!name) return null;

  if (draft.y.length < 4 || !draft.m || !draft.d) return null;
  const yy = parseInt(draft.y, 10);
  const mm = parseInt(draft.m, 10);
  const dd = parseInt(draft.d, 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (yy < 1900 || yy > CURRENT_YEAR) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(yy, mm)) return null;

  let time: { hour: number; minute: number } | null = null;
  if (draft.timeKnown) {
    if (!draft.h || !draft.min) return null;
    const hh = parseInt(draft.h, 10);
    const mn = parseInt(draft.min, 10);
    if (Number.isNaN(hh) || hh < 0 || hh > 23 || Number.isNaN(mn) || mn < 0 || mn > 59) return null;
    time = { hour: hh, minute: mn };
  }

  const input: CreateProfileBody = {
    name,
    gender: draft.gender,
    calendar: draft.calendar,
    isLeapMonth: draft.calendar === "lunar" && draft.isLeapMonth,
    birth: { year: yy, month: mm, day: dd },
    timeKnown: draft.timeKnown,
    time,
    // 출생지는 이 화면에서 묻지 않는다 — 몰라도 saju-core 가 서울 경도로 물러선다.
    birthPlace: null,
    // 진태양시 보정도 묻지 않는다 — 퍼널도 별도 스텝 없이 항상 true 다.
    trueSolar: true,
  };
  return { kind: "new", input, name };
}

const FIELD =
  "rounded-xl border border-slate-200 bg-white px-3 py-3 text-[15px] font-bold text-slate-900 text-center outline-none focus:border-accent placeholder:text-slate-300 disabled:opacity-40";
const PERSON_BTN =
  "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors";
const PERSON_BTN_ON = "border-accent bg-accent-50";
const PERSON_BTN_OFF = "border-slate-200 bg-white hover:border-slate-300";

export function CounterpartPicker({ people, excludeId, value, onChange }: Props) {
  const candidates = people.filter((p) => p.id !== excludeId);
  const [segment, setSegment] = useState<Segment>(candidates.length > 0 ? "saved" : "new");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // 부모의 CounterpartValue 를 그대로 따라간다(별도 로컬 state 를 두지 않는다) —
  // "나"를 바꿔 이 사람이 후보에서 빠지는 경우에도 두 값이 어긋날 일이 없다.
  const selectedSavedId = value?.kind === "saved" ? value.profileId : null;

  function selectSegment(next: Segment) {
    setSegment(next);
    if (next === "saved") {
      const person = candidates.find((p) => p.id === selectedSavedId);
      onChange(person ? { kind: "saved", profileId: person.id, name: person.name } : null);
    } else {
      onChange(toCounterpart(draft));
    }
  }

  function selectSaved(person: PersonOption) {
    onChange({ kind: "saved", profileId: person.id, name: person.name });
  }

  function updateDraft(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(toCounterpart(next));
  }

  const leapAvailable = (() => {
    const yy = parseInt(draft.y, 10);
    const mm = parseInt(draft.m, 10);
    return draft.calendar === "lunar" && !Number.isNaN(yy) && !Number.isNaN(mm) && hasLeapMonth(yy, mm);
  })();

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-bold tracking-[-0.02em]">상대는 누구인가요?</h2>
      <p className="mb-3 text-[13px] text-gray-500">저장된 사람 중에서 고르거나 새로 입력해요</p>

      <SegmentedControl<Segment>
        options={[
          { value: "saved", label: "저장된 사람" },
          { value: "new", label: "새로 입력" },
        ]}
        value={segment}
        onChange={selectSegment}
        className="mb-3 max-w-[280px]"
      />

      {segment === "saved" ? (
        candidates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13.5px] text-slate-400">
            저장된 사람이 없어요. 새로 입력해 주세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectSaved(p)}
                aria-pressed={selectedSavedId === p.id}
                className={`${PERSON_BTN} ${selectedSavedId === p.id ? PERSON_BTN_ON : PERSON_BTN_OFF}`}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-[13.5px] font-bold text-slate-500">
                  {p.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-slate-900">
                    {p.name}
                  </span>
                  <span className="block text-[12.5px] text-slate-400">{p.birthLabel}</span>
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <input
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="이름"
            aria-label="상대 이름"
            maxLength={20}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-semibold outline-none focus:border-accent placeholder:text-slate-300"
          />

          <div className="flex gap-2" role="radiogroup" aria-label="상대 성별">
            <button
              type="button"
              role="radio"
              aria-checked={draft.gender === "male"}
              onClick={() => updateDraft({ gender: "male" })}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                draft.gender === "male"
                  ? "border-accent bg-accent-50 text-accent"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              남성
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={draft.gender === "female"}
              onClick={() => updateDraft({ gender: "female" })}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                draft.gender === "female"
                  ? "border-accent bg-accent-50 text-accent"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              여성
            </button>
          </div>

          <SegmentedControl<"solar" | "lunar">
            options={[
              { value: "solar", label: "양력" },
              { value: "lunar", label: "음력" },
            ]}
            value={draft.calendar}
            onChange={(calendar) =>
              updateDraft({ calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
            }
          />

          <div className="flex items-center gap-2">
            <input
              value={draft.y}
              onChange={(e) => updateDraft({ y: digitsOnly(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="1990"
              aria-label="상대 생년"
              className={`w-[84px] ${FIELD}`}
            />
            <span className="text-sm text-slate-400">년</span>
            <input
              value={draft.m}
              onChange={(e) => updateDraft({ m: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="상대 생월"
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-400">월</span>
            <input
              value={draft.d}
              onChange={(e) => updateDraft({ d: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="상대 생일"
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-400">일</span>
          </div>

          {leapAvailable && (
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <span className="text-[13px] text-slate-600">윤달</span>
              <Toggle checked={draft.isLeapMonth} onChange={(v) => updateDraft({ isLeapMonth: v })} label="윤달" />
            </label>
          )}

          <div className="flex items-center gap-2">
            <input
              value={draft.h}
              onChange={(e) => updateDraft({ h: digitsOnly(e.target.value, 2) })}
              disabled={!draft.timeKnown}
              inputMode="numeric"
              placeholder="12"
              aria-label="상대 태어난 시"
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-400">시</span>
            <input
              value={draft.min}
              onChange={(e) => updateDraft({ min: digitsOnly(e.target.value, 2) })}
              disabled={!draft.timeKnown}
              inputMode="numeric"
              placeholder="00"
              aria-label="상대 태어난 분"
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-400">분</span>
            <button
              type="button"
              onClick={() => updateDraft({ timeKnown: !draft.timeKnown })}
              aria-pressed={!draft.timeKnown}
              className="ml-auto text-[12.5px] font-semibold text-slate-500 hover:text-slate-700"
            >
              {draft.timeKnown ? "시간 몰라요" : "시간 입력할게요"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
