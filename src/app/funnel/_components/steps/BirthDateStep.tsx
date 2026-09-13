"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { PickerSheet } from "@/components/wheel-picker/PickerSheet";
import { WheelPicker } from "@/components/wheel-picker/WheelPicker";
import { range } from "@/components/wheel-picker/model";
import { hasLeapMonth } from "@/lib/saju-core";
import { useFunnel, type Calendar, type FunnelData } from "../../_context/FunnelContext";
import { clampDay, daysInMonth, formatDate } from "../../_lib/date";
import { StepHeading } from "../StepHeading";
import { PickerField } from "../PickerField";

const MIN_YEAR = 1930;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = range(MIN_YEAR, CURRENT_YEAR);
const MONTHS = range(1, 12);

type Birth = NonNullable<FunnelData["birth"]>;

/** 처음 여는 휠의 시작 위치. 값이 아니라 굴리기 시작할 자리일 뿐이다. */
const DEFAULT_DRAFT: Birth = { y: 1995, m: 1, d: 1 };

export function BirthDateStep() {
  const { data, update } = useFunnel();
  const birth = data.birth;
  // 시트 안의 초안. null 이면 닫힌 것이다. "확인"에서만 컨텍스트로 간다.
  const [draft, setDraft] = useState<Birth | null>(null);

  function applyBirth(next: Birth | null) {
    const patch: Partial<FunnelData> = { birth: next };
    if (!next || (data.calendar === "lunar" && !hasLeapMonth(next.y, next.m))) {
      patch.isLeapMonth = false;
    }
    update(patch);
  }

  return (
    <div>
      <StepHeading
        title={
          <>
            생년월일을
            <br className="md:hidden" /> 입력해주세요
          </>
        }
        sub="달력 종류를 먼저 선택해주세요."
        gap="mb-7 md:mb-8"
      />
      <SegmentedControl<Calendar>
        options={[
          { value: "solar", label: "양력" },
          { value: "lunar", label: "음력" },
        ]}
        value={data.calendar}
        onChange={(calendar) =>
          update({
            calendar,
            ...(calendar === "solar" ? { isLeapMonth: false } : {}),
          })
        }
        className="mb-[18px] md:mb-5 md:max-w-[240px]"
      />
      <PickerField
        value={birth ? formatDate(birth) : null}
        placeholder="생년월일 선택"
        icon="📅"
        aria-label="생년월일"
        onClick={() => setDraft(birth ?? DEFAULT_DRAFT)}
      />

      {data.calendar === "lunar" && birth && hasLeapMonth(birth.y, birth.m) && (
        <div className="mt-4 flex items-center justify-between rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3.5 md:mt-5 md:rounded-[15px] md:px-[18px] md:py-4">
          <span>
            <span className="block text-sm font-semibold text-slate-700">윤달</span>
            <span className="mt-0.5 block text-xs text-slate-400 md:text-[12.5px]">
              {birth.m}월에 윤달로 태어났다면 켜주세요
            </span>
          </span>
          <Toggle
            checked={data.isLeapMonth}
            onChange={(v) => update({ isLeapMonth: v })}
            label="윤달"
          />
        </div>
      )}

      {/* 열 값은 함수형으로 갱신한다 — 두 열을 연달아 굴리면 스크롤 확정 타이머가
          같은 틱에 몰려 오고, 닫힌 초안을 쓰면 나중 열이 앞 열의 값을 되돌린다. */}
      {draft && (
        <PickerSheet
          title="생년월일"
          onCancel={() => setDraft(null)}
          onConfirm={() => {
            applyBirth(draft);
            setDraft(null);
          }}
        >
          <WheelPicker
            columns={[
              {
                id: "y",
                label: "년",
                values: YEARS,
                value: draft.y,
                format: (v) => `${v}년`,
                onChange: (y) => setDraft((p) => p && { y, m: p.m, d: clampDay(y, p.m, p.d) }),
              },
              {
                id: "m",
                label: "월",
                values: MONTHS,
                value: draft.m,
                format: (v) => `${v}월`,
                onChange: (m) => setDraft((p) => p && { y: p.y, m, d: clampDay(p.y, m, p.d) }),
              },
              {
                id: "d",
                label: "일",
                values: range(1, daysInMonth(draft.y, draft.m)),
                value: draft.d,
                format: (v) => `${v}일`,
                onChange: (d) => setDraft((p) => p && { ...p, d }),
              },
            ]}
          />
        </PickerSheet>
      )}
    </div>
  );
}
