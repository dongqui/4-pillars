"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { hasLeapMonth } from "@/lib/saju-core";
import { digitsOnly, draftIssues, type Draft, type DraftField } from "../_lib/to-counterpart";

interface Props {
  draft: Draft;
  onDraftChange: (patch: Partial<Draft>) => void;
}

const FIELD =
  "rounded-xl border border-slate-200 bg-white px-3 py-3 text-[15px] font-bold text-slate-900 text-center outline-none focus:border-accent placeholder:text-slate-300 disabled:opacity-40";
const HINT = "mt-1 text-[12px] text-slate-500";

/** 칸 묶음마다 한 줄. 무엇이 남았는지만 말하고 규칙을 설명하지 않는다. */
const HINT_TEXT: Record<DraftField, string> = {
  name: "이름을 적어 주세요",
  birth: "생년월일을 네 자리 연도까지 정확히 적어 주세요",
  time: "태어난 시각을 적어 주세요. 모르면 '시간 몰라요' 를 눌러요",
};

/**
 * 상대를 즉석으로 입력하는 폼. draft 를 소유하지 않는다(controlled) — CounterpartPicker 가
 * draft 의 유일한 진실의 원천이다. 이 폼이 스스로 상태를 들고 있으면, 세그먼트를
 * "저장된 사람" 으로 옮겼다 되돌아왔을 때 화면에 보이는 값과 실제로 제출되는 값이
 * 서로 다른 원천에서 나와 어긋날 수 있다.
 */
export function NewPersonForm({ draft, onDraftChange }: Props) {
  const leapAvailable = (() => {
    const yy = parseInt(draft.y, 10);
    const mm = parseInt(draft.m, 10);
    return draft.calendar === "lunar" && !Number.isNaN(yy) && !Number.isNaN(mm) && hasLeapMonth(yy, mm);
  })();

  // 아직 아무것도 손대지 않은 폼에는 안내를 띄우지 않는다 — 빈 폼에서 버튼이 꺼져
  // 있는 것은 사용자도 이미 안다. 한 글자라도 치면 그때부터 남은 칸을 짚어 준다.
  const touched =
    draft.name !== "" || draft.y !== "" || draft.m !== "" || draft.d !== "" ||
    draft.h !== "" || draft.min !== "";
  const issues = touched ? draftIssues(draft) : [];
  const hint = (field: DraftField) =>
    issues.includes(field) ? <p className={HINT}>{HINT_TEXT[field]}</p> : null;

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
      <div>
        <input
          value={draft.name}
          onChange={(e) => onDraftChange({ name: e.target.value })}
          placeholder="이름"
          aria-label="상대 이름"
          aria-invalid={issues.includes("name")}
          maxLength={20}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-semibold outline-none focus:border-accent placeholder:text-slate-300"
        />
        {hint("name")}
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="상대 성별">
        <button
          type="button"
          role="radio"
          aria-checked={draft.gender === "male"}
          onClick={() => onDraftChange({ gender: "male" })}
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
          onClick={() => onDraftChange({ gender: "female" })}
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
          onDraftChange({ calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
        }
      />

      <div>
        <div className="flex items-center gap-2">
          <input
            value={draft.y}
            onChange={(e) => onDraftChange({ y: digitsOnly(e.target.value, 4) })}
            inputMode="numeric"
            placeholder="1990"
            aria-label="상대 생년"
            aria-invalid={issues.includes("birth")}
            className={`w-[84px] ${FIELD}`}
          />
          <span className="text-sm text-slate-400">년</span>
          <input
            value={draft.m}
            onChange={(e) => onDraftChange({ m: digitsOnly(e.target.value, 2) })}
            inputMode="numeric"
            placeholder="1"
            aria-label="상대 생월"
            aria-invalid={issues.includes("birth")}
            className={`w-[56px] ${FIELD}`}
          />
          <span className="text-sm text-slate-400">월</span>
          <input
            value={draft.d}
            onChange={(e) => onDraftChange({ d: digitsOnly(e.target.value, 2) })}
            inputMode="numeric"
            placeholder="1"
            aria-label="상대 생일"
            aria-invalid={issues.includes("birth")}
            className={`w-[56px] ${FIELD}`}
          />
          <span className="text-sm text-slate-400">일</span>
        </div>
        {hint("birth")}
      </div>

      {leapAvailable && (
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <span className="text-[13px] text-slate-600">윤달</span>
          <Toggle
            checked={draft.isLeapMonth}
            onChange={(v) => onDraftChange({ isLeapMonth: v })}
            label="윤달"
          />
        </label>
      )}

      <div>
        <div className="flex items-center gap-2">
          <input
            value={draft.h}
            onChange={(e) => onDraftChange({ h: digitsOnly(e.target.value, 2) })}
            disabled={!draft.timeKnown}
            inputMode="numeric"
            placeholder="12"
            aria-label="상대 태어난 시"
            aria-invalid={issues.includes("time")}
            className={`w-[56px] ${FIELD}`}
          />
          <span className="text-sm text-slate-400">시</span>
          <input
            value={draft.min}
            onChange={(e) => onDraftChange({ min: digitsOnly(e.target.value, 2) })}
            disabled={!draft.timeKnown}
            inputMode="numeric"
            placeholder="00"
            aria-label="상대 태어난 분"
            aria-invalid={issues.includes("time")}
            className={`w-[56px] ${FIELD}`}
          />
          <span className="text-sm text-slate-400">분</span>
          <button
            type="button"
            onClick={() => onDraftChange({ timeKnown: !draft.timeKnown })}
            aria-pressed={!draft.timeKnown}
            className="ml-auto text-[12.5px] font-semibold text-slate-500 hover:text-slate-700"
          >
            {draft.timeKnown ? "시간 몰라요" : "시간 입력할게요"}
          </button>
        </div>
        {hint("time")}
      </div>
    </div>
  );
}
