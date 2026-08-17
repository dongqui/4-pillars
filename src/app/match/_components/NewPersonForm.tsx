"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { hasLeapMonth } from "@/lib/saju-core";
import type { CreateProfileBody } from "@/lib/profiles/input";
import { digitsOnly, emptyDraft, toCounterpart, type Draft } from "../_lib/to-counterpart";

interface Props {
  onChange: (next: CreateProfileBody | null) => void;
  /** 세그먼트가 "저장된 사람" 일 때도 마운트는 유지한 채 감춘다 — 탭을 오가도 입력이 안 지워진다. */
  hidden?: boolean;
}

const FIELD =
  "rounded-xl border border-slate-200 bg-white px-3 py-3 text-[15px] font-bold text-slate-900 text-center outline-none focus:border-accent placeholder:text-slate-300 disabled:opacity-40";

/** 상대를 즉석으로 입력하는 폼. 자기 draft 상태만 갖고, 유효할 때만 부모에 값을 올린다. */
export function NewPersonForm({ onChange, hidden = false }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);

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
    <div className={`space-y-3 rounded-2xl bg-slate-50 p-4 ${hidden ? "hidden" : ""}`}>
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
  );
}
