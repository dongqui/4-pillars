"use client";

import {
  RELATION_TYPES,
  ROLE_MAX_LENGTH,
  type RelationInput,
  type RelationTypeId,
} from "@/lib/matches/relation-types";

const CHIP = "rounded-full border px-4 py-2 text-sm transition-colors";
const CHIP_ON = "border-slate-900 bg-slate-900 text-white";
const CHIP_OFF = "border-slate-200 text-slate-600 hover:border-slate-300";
const FIELD =
  "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400";
const HINT = "text-[12px] text-slate-500 mt-1";

interface Props {
  value: RelationInput;
  onChange: (next: RelationInput) => void;
  /** 역할 칸의 라벨에 쓰는 이름 — "김동진은" */
  subjectName: string;
  counterpartName: string;
}

/** 공백만 넣은 칸은 채운 것이 아니다 — roleText 의 `.trim().min(1)` 과 같은 판정이다. */
const filled = (role: string | null) => (role ?? "").trim().length > 0;

/** 유형을 고르면 역할이 그 유형의 기본값으로 초기화된다 — 어긋난 조합은 API 가 막는다. */
function withType(type: RelationTypeId | null): RelationInput {
  if (type === null) return { type: null, subjectRole: null, counterpartRole: null };
  const roles = RELATION_TYPES[type].roles;
  if (roles === null) return { type, subjectRole: null, counterpartRole: null };
  if (roles === "free") return { type, subjectRole: "", counterpartRole: "" };
  return { type, subjectRole: roles[0], counterpartRole: roles[1] };
}

export function RelationPicker({ value, onChange, subjectName, counterpartName }: Props) {
  const roles = value.type === null ? null : RELATION_TYPES[value.type].roles;

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-bold tracking-[-0.02em]">두 사람은 어떤 관계인가요?</h2>
      <p className="mb-3 text-[13px] text-gray-500">관계에 따라 더 맞춤 해석을 드려요</p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(RELATION_TYPES) as RelationTypeId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={value.type === id}
            onClick={() => onChange(withType(value.type === id ? null : id))}
            className={`${CHIP} ${value.type === id ? CHIP_ON : CHIP_OFF}`}
          >
            {RELATION_TYPES[id].label}
          </button>
        ))}
      </div>

      {Array.isArray(roles) && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, subjectRole: value.counterpartRole, counterpartRole: value.subjectRole })
          }
          className="mt-3 text-sm font-bold text-accent"
        >
          {subjectName}이 {value.subjectRole} · 바꾸기 ↔
        </button>
      )}

      {/*
        두 칸을 다 채워야 제출이 열린다(MatchForm 의 canSubmit). 어느 칸이 비었는지
        말해 주지 않으면 사용자는 버튼이 왜 안 눌리는지 알 방법이 없다 — 스키마를
        느슨하게 푸는 대신 화면이 남은 일을 가리킨다.
      */}
      {roles === "free" && (
        <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4">
          <label className="flex items-start gap-3">
            <span className="w-20 shrink-0 pt-2.5 text-[13px] text-gray-500">{subjectName}은</span>
            <span className="min-w-0 flex-1">
              <input
                className={FIELD}
                maxLength={ROLE_MAX_LENGTH}
                placeholder="예: 멘토"
                aria-invalid={!filled(value.subjectRole)}
                value={value.subjectRole ?? ""}
                onChange={(e) => onChange({ ...value, subjectRole: e.target.value })}
              />
              {!filled(value.subjectRole) && (
                <span className={`block ${HINT}`}>{subjectName}의 역할을 적어 주세요</span>
              )}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <span className="w-20 shrink-0 pt-2.5 text-[13px] text-gray-500">
              {counterpartName}은
            </span>
            <span className="min-w-0 flex-1">
              <input
                className={FIELD}
                maxLength={ROLE_MAX_LENGTH}
                placeholder="예: 멘티"
                aria-invalid={!filled(value.counterpartRole)}
                value={value.counterpartRole ?? ""}
                onChange={(e) => onChange({ ...value, counterpartRole: e.target.value })}
              />
              {!filled(value.counterpartRole) && (
                <span className={`block ${HINT}`}>{counterpartName}의 역할을 적어 주세요</span>
              )}
            </span>
          </label>
        </div>
      )}
    </section>
  );
}
