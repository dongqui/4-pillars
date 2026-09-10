"use client";

import { useState } from "react";
import { PickerSheet } from "@/components/wheel-picker/PickerSheet";
import { WheelPicker } from "@/components/wheel-picker/WheelPicker";
import { pad2, range } from "@/components/wheel-picker/model";
import { useFunnel, type FunnelData } from "../../_context/FunnelContext";
import { formatTime } from "../../_lib/date";
import { StepHeading } from "../StepHeading";
import { PickerField } from "../PickerField";

const HOURS = range(0, 23);
/** 분은 1분 단위다 — 시안은 5분 눈금이었지만 실제 출생 시각은 그렇게 떨어지지 않는다. */
const MINUTES = range(0, 59);

type Time = NonNullable<FunnelData["time"]>;

/** 처음 여는 휠의 시작 위치. */
const DEFAULT_DRAFT: Time = { h: 12, m: 0 };

export function BirthTimeStep() {
  const { data, update } = useFunnel();
  const time = data.time;
  const [draft, setDraft] = useState<Time | null>(null);

  function open() {
    // "몰라요"가 켜진 채로 칸을 누르면 다시 입력하려는 것이다 — 시안의 openPicker 와 같다.
    if (!data.timeKnown) update({ timeKnown: true });
    setDraft(time ?? DEFAULT_DRAFT);
  }

  return (
    <div>
      <StepHeading
        title={
          <>
            태어난 시간을
            <br className="md:hidden" /> 알려주세요
          </>
        }
        sub="시(時) 기둥 계산에 사용돼요."
        gap="mb-7 md:mb-8"
      />

      <PickerField
        value={data.timeKnown ? (time ? formatTime(time) : null) : "시간 모름"}
        placeholder="시간 선택"
        icon="🕓"
        aria-label="태어난 시간"
        muted={!data.timeKnown}
        onClick={open}
      />

      <button
        type="button"
        onClick={() => update({ timeKnown: !data.timeKnown })}
        aria-pressed={!data.timeKnown}
        className={`mt-3.5 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all md:mt-4 md:rounded-[13px] md:px-[18px] md:py-4 ${
          data.timeKnown
            ? "border border-slate-200 bg-white text-slate-500"
            : "border-2 border-accent bg-accent-50 text-accent"
        }`}
      >
        <span className="text-[15px] md:text-base">{data.timeKnown ? "○" : "●"}</span>
        태어난 시간을 몰라요
      </button>

      {/* 열 값은 함수형으로 갱신한다 — 두 열을 연달아 굴리면 스크롤 확정 타이머가
          같은 틱에 몰려 오고, 닫힌 초안을 쓰면 나중 열이 앞 열의 값을 되돌린다. */}
      {draft && (
        <PickerSheet
          title="태어난 시간"
          onCancel={() => setDraft(null)}
          onConfirm={() => {
            update({ time: draft, timeKnown: true });
            setDraft(null);
          }}
        >
          <WheelPicker
            columns={[
              {
                id: "h",
                label: "시",
                values: HOURS,
                value: draft.h,
                format: (v) => `${pad2(v)}시`,
                onChange: (h) => setDraft((p) => p && { ...p, h }),
              },
              {
                id: "min",
                label: "분",
                values: MINUTES,
                value: draft.m,
                format: (v) => `${pad2(v)}분`,
                onChange: (m) => setDraft((p) => p && { ...p, m }),
              },
            ]}
          />
        </PickerSheet>
      )}
    </div>
  );
}
