"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { hasLeapMonth } from "@/lib/saju-core";
import { createCharacter, type StartState } from "../actions";

const INITIAL: StartState = { error: null };

const fieldCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-center text-[17px] font-bold text-slate-900 outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-50 placeholder:font-medium placeholder:text-slate-300";

function digits(raw: string, max: number): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

export function StartForm() {
  const [state, formAction, pending] = useActionState(createCharacter, INITIAL);
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  const filled = year.length === 4 && month !== "" && day !== "";
  // 윤달 체크는 그 해 그 달에 실제로 윤달이 있을 때만 묻는다 — 없는 달에 물으면
  // 사용자가 잘못 켜고 계산이 어긋난다.
  const showLeap =
    calendar === "lunar" && year.length === 4 && month !== "" && hasLeapMonth(+year, +month);

  return (
    <form action={formAction}>
      <input type="hidden" name="calendar" value={calendar} />

      <div className="mb-[30px] flex h-10 items-center gap-3">
        <Link
          href="/"
          aria-label="돌아가기"
          className="flex h-[30px] w-[30px] items-center justify-center text-[26px] leading-none text-slate-700"
        >
          ‹
        </Link>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-full rounded-full bg-accent" />
        </div>
        <span className="w-7 text-right text-xs font-semibold text-slate-400">1/1</span>
      </div>

      <h1 className="mb-2 text-[25px] font-bold leading-[1.3] tracking-[-0.025em]">
        생일을 알려주세요
      </h1>
      <p className="mb-7 text-[14.5px] text-slate-500">태어난 날 하나면 캐릭터가 나와요.</p>

      <SegmentedControl<"solar" | "lunar">
        options={[
          { value: "solar", label: "양력" },
          { value: "lunar", label: "음력" },
        ]}
        value={calendar}
        onChange={setCalendar}
        className="mb-[18px]"
      />

      <span className="mb-2 block text-[13px] font-semibold text-slate-600">생년월일</span>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <input
          name="year"
          value={year}
          onChange={(e) => setYear(digits(e.target.value, 4))}
          inputMode="numeric"
          placeholder="1990"
          aria-label="년"
          autoFocus
          className={fieldCls}
        />
        <input
          name="month"
          value={month}
          onChange={(e) => setMonth(digits(e.target.value, 2))}
          inputMode="numeric"
          placeholder="10"
          aria-label="월"
          className={fieldCls}
        />
        <input
          name="day"
          value={day}
          onChange={(e) => setDay(digits(e.target.value, 2))}
          inputMode="numeric"
          placeholder="25"
          aria-label="일"
          className={fieldCls}
        />
      </div>

      {state.error && (
        <div className="mt-2.5 flex items-center gap-[7px]">
          <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            !
          </span>
          <span className="text-[13px] font-medium text-red-600">{state.error}</span>
        </div>
      )}

      {showLeap && (
        <label className="mt-3.5 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="isLeapMonth"
            className="h-[19px] w-[19px] flex-none accent-accent"
          />
          <span className="text-[14.5px] text-slate-600">윤달이에요</span>
        </label>
      )}

      <label
        htmlFor="start-name"
        className="mb-2 mt-[22px] block text-[13px] font-semibold text-slate-600"
      >
        이름 <span className="font-medium text-slate-400">선택</span>
      </label>
      <input
        id="start-name"
        name="name"
        maxLength={20}
        placeholder="비워둬도 괜찮아요"
        className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-[15px] text-base text-slate-900 outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-50 placeholder:text-slate-400"
      />

      <button
        type="submit"
        disabled={!filled || pending}
        className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-accent py-[17px] text-base font-bold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.9)] hover:bg-accent-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
      >
        {pending && (
          <span className="inline-block h-[17px] w-[17px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
        )}
        {pending ? "캐릭터를 고르는 중" : "내 캐릭터 알아보기"}
      </button>
      <p className="mt-3.5 text-center text-[12.5px] text-slate-400 [text-wrap:pretty]">
        로그인 없음 · 생일은 이 브라우저에만 저장돼요
      </p>
    </form>
  );
}
