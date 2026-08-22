"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { hasLeapMonth } from "@/lib/saju-core";
import { digitsOnly, draftIssues, type Draft, type DraftField } from "../_lib/to-counterpart";

const FIELD =
  "min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-[15px] text-slate-900 outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,99,235,.12)] placeholder:text-slate-300 disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300";
const UNIT = "flex-none text-[13px] text-slate-400";
const GROUP_LABEL = "mb-[7px] text-[12px] font-semibold text-slate-500";
const HINT = "mt-1 text-[12px] text-slate-500";

/** 칸 묶음마다 한 줄. 무엇이 남았는지만 말하고 규칙을 설명하지 않는다. */
const HINT_TEXT: Record<DraftField, string> = {
  name: "이름을 적어 주세요",
  birth: "생년월일을 네 자리 연도까지 정확히 적어 주세요",
  time: "태어난 시각을 적어 주세요. 모르면 '태어난 시간을 몰라요' 를 눌러요",
};

interface Props {
  /** "내 사주 추가" | "상대 정보 입력" */
  title: string;
  /** 확인 버튼 문구 — "추가하기" | "이 사람으로 보기" */
  submitLabel: string;
  /** 저장 체크박스 문구. 나와 상대가 다른 말을 쓴다 */
  saveLabel: string;
  saveHint: string;
  draft: Draft;
  onDraftChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  /** 서버에 쓰는 동안(내 사주 추가) 버튼을 잠근다 */
  pending?: boolean;
  error?: string | null;
}

/**
 * 사람 하나를 즉석으로 입력하는 폼. draft 를 소유하지 않는다(controlled) — MatchForm 이
 * draft 의 유일한 진실의 원천이다. 이 폼이 스스로 상태를 들고 있으면, 폼을 닫았다
 * 다시 열었을 때 화면에 보이는 값과 실제로 제출되는 값이 서로 다른 원천에서 나와
 * 어긋날 수 있다.
 *
 * "나" 와 "상대" 가 같은 폼을 쓴다 — 묻는 것이 똑같기 때문이다. 다른 것은 제목과
 * 버튼 문구, 저장 체크박스의 설명뿐이라 props 로 받는다.
 */
export function NewPersonForm({
  title,
  submitLabel,
  saveLabel,
  saveHint,
  draft,
  onDraftChange,
  onCancel,
  onSubmit,
  pending = false,
  error = null,
}: Props) {
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
  const issues = draftIssues(draft);
  const hint = (field: DraftField) =>
    touched && issues.includes(field) ? <p className={HINT}>{HINT_TEXT[field]}</p> : null;
  const valid = issues.length === 0;

  return (
    <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-[18px]">
      <div className="mb-3.5 text-[13.5px] font-bold">{title}</div>

      <div className="flex flex-col gap-3">
        <div>
          <input
            value={draft.name}
            onChange={(e) => onDraftChange({ name: e.target.value })}
            placeholder="이름"
            aria-label="이름"
            aria-invalid={issues.includes("name")}
            maxLength={20}
            className={`w-full ${FIELD} px-3.5 text-left`}
          />
          {hint("name")}
        </div>

        <SegmentedControl<"male" | "female">
          options={[
            { value: "male", label: "남성" },
            { value: "female", label: "여성" },
          ]}
          value={draft.gender}
          onChange={(gender) => onDraftChange({ gender })}
        />

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
          <div className={GROUP_LABEL}>생년월일</div>
          <div className="flex items-center gap-2">
            <input
              value={draft.y}
              onChange={(e) => onDraftChange({ y: digitsOnly(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="1990"
              aria-label="생년"
              aria-invalid={issues.includes("birth")}
              className={`flex-[1.3] ${FIELD}`}
            />
            <span className={UNIT}>년</span>
            <input
              value={draft.m}
              onChange={(e) => onDraftChange({ m: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생월"
              aria-invalid={issues.includes("birth")}
              className={`flex-1 ${FIELD}`}
            />
            <span className={UNIT}>월</span>
            <input
              value={draft.d}
              onChange={(e) => onDraftChange({ d: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생일"
              aria-invalid={issues.includes("birth")}
              className={`flex-1 ${FIELD}`}
            />
            <span className={UNIT}>일</span>
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
          <div className={GROUP_LABEL}>태어난 시간</div>
          <div className="flex items-center gap-2">
            <input
              value={draft.h}
              onChange={(e) => onDraftChange({ h: digitsOnly(e.target.value, 2) })}
              disabled={!draft.timeKnown}
              inputMode="numeric"
              placeholder="12"
              aria-label="태어난 시"
              aria-invalid={issues.includes("time")}
              className={`flex-1 ${FIELD}`}
            />
            <span className={UNIT}>시</span>
            <input
              value={draft.min}
              onChange={(e) => onDraftChange({ min: digitsOnly(e.target.value, 2) })}
              disabled={!draft.timeKnown}
              inputMode="numeric"
              placeholder="00"
              aria-label="태어난 분"
              aria-invalid={issues.includes("time")}
              className={`flex-1 ${FIELD}`}
            />
            <span className={UNIT}>분</span>
          </div>
          <Checkbox
            checked={!draft.timeKnown}
            onChange={(on) => onDraftChange({ timeKnown: !on })}
            className="mt-2.5"
          >
            <span className="text-[13.5px] font-medium text-slate-600">태어난 시간을 몰라요</span>
          </Checkbox>
          {hint("time")}
        </div>

        <div className="my-0.5 h-px bg-slate-100" />

        <Checkbox checked={draft.saved} onChange={(saved) => onDraftChange({ saved })}>
          <span>
            <span className="block text-[13.5px] font-semibold text-slate-700">{saveLabel}</span>
            <span className="mt-0.5 block text-[12px] text-slate-400">{saveHint}</span>
          </span>
        </Checkbox>

        {error && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700">{error}</p>
        )}

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-none rounded-xl border border-slate-200 bg-white px-[18px] py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!valid || pending}
            className="flex-1 rounded-xl bg-accent py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {pending ? "저장하는 중..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * 네이티브 input 을 숨기지 않고 그 위에 그린다 — peer 로 상태를 받아 칠하면
 * 키보드 포커스와 스페이스바, 스크린리더가 공짜로 따라온다.
 */
function Checkbox({ checked, onChange, className = "", children }: CheckboxProps) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] border-slate-300 bg-white transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent-200">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className={checked ? "opacity-100" : "opacity-0"}
        >
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {children}
    </label>
  );
}
